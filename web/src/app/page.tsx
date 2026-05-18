import { redirect } from "next/navigation";
import { getHomePath } from "@/lib/auth/paths";
import { getSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(getHomePath(session.role));
}
