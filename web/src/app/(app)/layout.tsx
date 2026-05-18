import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppNav } from "@/components/AppNav";
import { ToastProvider } from "@/components/Toast";
import { AppDataProvider } from "@/context/AppDataContext";
import { LocaleProvider } from "@/context/LocaleContext";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <LocaleProvider>
      <ToastProvider>
        <AppDataProvider role={session.role}>
        <AppNav displayName={session.displayName} role={session.role} />
        <main className={session.role === "operator" ? "main--operator" : undefined}>
          {children}
        </main>
        </AppDataProvider>
      </ToastProvider>
    </LocaleProvider>
  );
}
