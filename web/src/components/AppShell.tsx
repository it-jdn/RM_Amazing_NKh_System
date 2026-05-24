"use client";

import { AppNav } from "@/components/AppNav";
import { OperatorBottomNav } from "@/components/operator/OperatorBottomNav";
import { AdminUnsavedChangesProvider } from "@/components/admin/AdminUnsavedChangesProvider";
import { IntakeNavGuardProvider } from "@/context/IntakeNavGuardContext";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import type { AppRole } from "@/lib/types";
import type { ReactNode } from "react";

function OperatorShell({ children }: { children: ReactNode }) {
  const isPhone = usePhoneLayout();
  return (
    <>
      <main className={`main--operator${isPhone ? " main--with-bottom-nav" : ""}`}>{children}</main>
      {isPhone ? <OperatorBottomNav /> : null}
    </>
  );
}

export function AppShell({
  displayName,
  role,
  children,
}: {
  displayName?: string;
  role: AppRole;
  children: ReactNode;
}) {
  return (
    <IntakeNavGuardProvider>
      <AdminUnsavedChangesProvider>
        <AppNav displayName={displayName} role={role} />
        {role === "operator" ? <OperatorShell>{children}</OperatorShell> : <main>{children}</main>}
      </AdminUnsavedChangesProvider>
    </IntakeNavGuardProvider>
  );
}
