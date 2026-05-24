"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RECEIVING_PATH } from "@/lib/auth/paths";

export type LeaveNavigationHandler = (href: string) => void;

type IntakeNavGuardContextValue = {
  intakeDirty: boolean;
  setIntakeDirty: (value: boolean) => void;
  setLeaveNavigationHandler: (handler: LeaveNavigationHandler | null) => void;
  /** Returns true if IntakeView handled the request (modal or in-page nav). */
  requestLeave: (href: string, alwaysRunLeave?: boolean) => boolean;
};

const IntakeNavGuardContext = createContext<IntakeNavGuardContextValue | null>(null);

export function IntakeNavGuardProvider({ children }: { children: ReactNode }) {
  const [intakeDirty, setIntakeDirty] = useState(false);
  const leaveHandlerRef = useRef<LeaveNavigationHandler | null>(null);

  const setLeaveNavigationHandler = useCallback((handler: LeaveNavigationHandler | null) => {
    leaveHandlerRef.current = handler;
  }, []);

  const requestLeave = useCallback((href: string, alwaysRunLeave?: boolean) => {
    const handler = leaveHandlerRef.current;
    if (!handler) return false;
    if (!alwaysRunLeave && !intakeDirty) {
      return false;
    }
    handler(href);
    return true;
  }, [intakeDirty]);

  const value = useMemo(
    () => ({ intakeDirty, setIntakeDirty, setLeaveNavigationHandler, requestLeave }),
    [intakeDirty, setLeaveNavigationHandler, requestLeave]
  );

  return <IntakeNavGuardContext.Provider value={value}>{children}</IntakeNavGuardContext.Provider>;
}

export function useIntakeNavGuardOptional() {
  return useContext(IntakeNavGuardContext);
}
