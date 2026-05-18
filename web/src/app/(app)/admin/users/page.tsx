import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminUsersPanel } from "@/components/pages/admin/AdminUsersPanel";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin/shops");
  }
  return <AdminUsersPanel />;
}
