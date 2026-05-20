"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type IntakeNavGuardContextValue = {
  intakeDirty: boolean;
  setIntakeDirty: (value: boolean) => void;
};

const IntakeNavGuardContext = createContext<IntakeNavGuardContextValue | null>(null);

export function IntakeNavGuardProvider({ children }: { children: ReactNode }) {
  const [intakeDirty, setIntakeDirty] = useState(false);
  const value = useMemo(
    () => ({ intakeDirty, setIntakeDirty }),
    [intakeDirty]
  );
  return <IntakeNavGuardContext.Provider value={value}>{children}</IntakeNavGuardContext.Provider>;
}

export function useIntakeNavGuardOptional() {
  return useContext(IntakeNavGuardContext);
}
