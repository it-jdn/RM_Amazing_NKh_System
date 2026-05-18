import { Suspense } from "react";
import { AdminItemsPanel } from "@/components/pages/admin/AdminItemsPanel";

export default function AdminItemsPage() {
  return (
    <Suspense fallback={<p className="admin-hint">…</p>}>
      <AdminItemsPanel />
    </Suspense>
  );
}
