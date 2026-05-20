"use client";

import { AppNav } from "@/components/AppNav";
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
        <main className={role === "operator" ? "main--operator" : undefined}>{children}</main>
      </AdminUnsavedChangesProvider>
    </IntakeNavGuardProvider>
  );
}
