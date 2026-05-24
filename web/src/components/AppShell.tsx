"use client";

import { AppNav } from "@/components/AppNav";
import { OperatorBottomNav } from "@/components/operator/OperatorBottomNav";
import { AdminUnsavedChangesProvider } from "@/components/admin/AdminUnsavedChangesProvider";
import { IntakeNavGuardProvider } from "@/context/IntakeNavGuardContext";
import type { AppRole } from "@/lib/types";
import type { ReactNode } from "react";

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
        <main className={role === "operator" ? "main--operator main--with-bottom-nav" : undefined}>
          {children}
        </main>
        {role === "operator" ? <OperatorBottomNav /> : null}
      </AdminUnsavedChangesProvider>
    </IntakeNavGuardProvider>
  );
}
