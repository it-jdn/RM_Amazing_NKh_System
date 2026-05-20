"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { useModalLayer } from "@/hooks/useModalLayer";
import { isAdminCatalogPath } from "@/lib/navigation/admin-nav";

type SaveHandler = () => Promise<boolean>;
type DiscardHandler = () => void;

type AdminUnsavedContextValue = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  registerHandlers: (handlers: { save: SaveHandler; discard: DiscardHandler } | null) => void;
  requestNavigation: (href: string) => void;
  guardAction: (action: () => void, isDirty?: boolean) => void;
};

const AdminUnsavedContext = createContext<AdminUnsavedContextValue | null>(null);

export function useAdminUnsaved() {
  const ctx = useContext(AdminUnsavedContext);
  if (!ctx) {
    throw new Error("useAdminUnsaved must be used within AdminUnsavedChangesProvider");
  }
  return ctx;
}

export function useAdminUnsavedOptional() {
  return useContext(AdminUnsavedContext);
}

export function useAdminFormUnsaved(opts: {
  dirty: boolean;
  save: SaveHandler;
  discard: DiscardHandler;
}) {
  const { setDirty, registerHandlers, guardAction, requestNavigation } = useAdminUnsaved();
  const saveRef = useRef(opts.save);
  const discardRef = useRef(opts.discard);
  saveRef.current = opts.save;
  discardRef.current = opts.discard;

  useLayoutEffect(() => {
    setDirty(opts.dirty);
  }, [opts.dirty, setDirty]);

  useEffect(() => {
    registerHandlers({
      save: () => saveRef.current(),
      discard: () => discardRef.current(),
    });
    return () => registerHandlers(null);
  }, [registerHandlers]);

  return { guardAction, requestNavigation };
}

export function AdminUnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLocale();
  const active = isAdminCatalogPath(pathname);

  const [dirty, setDirtyState] = useState(false);
  const dirtyRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveHandlerRef = useRef<SaveHandler | null>(null);
  const discardHandlerRef = useRef<DiscardHandler | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const setDirty = useCallback((value: boolean) => {
    dirtyRef.current = value;
    setDirtyState(value);
  }, []);

  useEffect(() => {
    dirtyRef.current = false;
    setDirtyState(false);
    setOpen(false);
    setPendingHref(null);
    pendingActionRef.current = null;
  }, [pathname]);

  const registerHandlers = useCallback((handlers: { save: SaveHandler; discard: DiscardHandler } | null) => {
    saveHandlerRef.current = handlers?.save ?? null;
    discardHandlerRef.current = handlers?.discard ?? null;
  }, []);

  const finishPending = useCallback(() => {
    const href = pendingHref;
    const action = pendingActionRef.current;
    setOpen(false);
    setPendingHref(null);
    pendingActionRef.current = null;
    if (href) router.push(href);
    else action?.();
  }, [pendingHref, router]);

  const openPrompt = useCallback((href: string | null, action: (() => void) | null) => {
    setPendingHref(href);
    pendingActionRef.current = action;
    setOpen(true);
  }, []);

  const requestNavigation = useCallback(
    (href: string) => {
      if (!dirtyRef.current) {
        router.push(href);
        return;
      }
      if (href === pathname) return;
      openPrompt(href, null);
    },
    [openPrompt, pathname, router]
  );

  const guardAction = useCallback(
    (action: () => void, isDirty?: boolean) => {
      const shouldGuard = isDirty ?? dirtyRef.current;
      if (!shouldGuard) {
        action();
        return;
      }
      openPrompt(null, action);
    },
    [openPrompt]
  );

  const onDiscard = useCallback(() => {
    discardHandlerRef.current?.();
    setDirty(false);
    finishPending();
  }, [finishPending, setDirty]);

  const closeUnsavedPrompt = useCallback(() => {
    setOpen(false);
    setPendingHref(null);
    pendingActionRef.current = null;
  }, []);

  useModalLayer({ open, onClose: closeUnsavedPrompt, busy: saving });

  const onSave = useCallback(async () => {
    const save = saveHandlerRef.current;
    if (!save) return;
    setSaving(true);
    try {
      const ok = await save();
      if (ok) {
        setDirty(false);
        finishPending();
      }
    } finally {
      setSaving(false);
    }
  }, [finishPending, setDirty]);

  const value = useMemo<AdminUnsavedContextValue>(
    () => ({
      dirty,
      setDirty,
      registerHandlers,
      requestNavigation,
      guardAction,
    }),
    [dirty, setDirty, registerHandlers, requestNavigation, guardAction]
  );

  return (
    <AdminUnsavedContext.Provider value={value}>
      {children}
      {active && open ? (
        <div
          className="modal-overlay open"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setOpen(false);
              setPendingHref(null);
              pendingActionRef.current = null;
            }
          }}
        >
          <div
            className="modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-unsaved-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span id="admin-unsaved-title" className="modal-title">
                {t("admin.unsaved.title")}
              </span>
            </div>
            <div className="modal-body">
              <p className="admin-unsaved-modal__message">{t("admin.unsaved.message")}</p>
            </div>
            <div className="modal-footer admin-unsaved-modal__footer">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => void onSave()}
              >
                {saving ? t("profile.saving") : t("admin.unsaved.save")}
              </button>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={onDiscard}>
                {t("admin.unsaved.discard")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={saving}
                onClick={closeUnsavedPrompt}
              >
                {t("admin.unsaved.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminUnsavedContext.Provider>
  );
}
