"use client";

import { createContext, useCallback, useContext, useState } from "react";

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);

  const toast = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    setTimeout(() => setShow(false), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <ToastBar msg={msg} show={show} />
    </ToastCtx.Provider>
  );
}

function ToastBar({ msg, show }: { msg: string; show: boolean }) {
  return (
    <div id="toast" className={show ? "show" : ""}>
      {msg}
    </div>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
