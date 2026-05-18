"use client";

import { usePathname } from "next/navigation";
import { AdminSubNav } from "@/components/admin/AdminSubNav";
import { AdminUnsavedChangesProvider } from "@/components/admin/AdminUnsavedChangesProvider";
import { isAdminUsersPath } from "@/lib/navigation/admin-nav";
import type { AppRole } from "@/lib/types";

export function AdminLayoutChrome({
  role,
  children,
}: {
  role: AppRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onUsersPage = isAdminUsersPath(pathname);

  return (
    <AdminUnsavedChangesProvider>
      {!onUsersPage ? <AdminSubNav role={role} /> : null}
      {children}
    </AdminUnsavedChangesProvider>
  );
}
