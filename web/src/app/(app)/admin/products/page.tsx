import { redirect } from "next/navigation";

/** @deprecated รวมอยู่ที่ /admin/items — ปุ่ม「ผูกร้านค้า」ในตารางสินค้า */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const item = typeof sp.item === "string" ? sp.item.trim() : "";
  const edit = typeof sp.edit === "string" ? sp.edit.trim() : "";
  const code = item || edit;
  if (code) {
    redirect(`/admin/items?link=${encodeURIComponent(code)}`);
  }
  redirect("/admin/items");
}
