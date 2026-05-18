import { redirect } from "next/navigation";
import { AdminLayoutChrome } from "@/components/admin/AdminLayoutChrome";
import { getSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="wrap admin-layout">
      <AdminLayoutChrome role={session.role}>{children}</AdminLayoutChrome>
    </div>
  );
}
