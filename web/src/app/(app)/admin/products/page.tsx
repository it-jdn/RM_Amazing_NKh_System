import { Suspense } from "react";
import { AdminProductsPanel } from "@/components/pages/admin/AdminProductsPanel";

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<p className="admin-hint">…</p>}>
      <AdminProductsPanel />
    </Suspense>
  );
}
