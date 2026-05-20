import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/AppShell";
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
          <AppShell displayName={session.displayName} role={session.role}>
            {children}
          </AppShell>
        </AppDataProvider>
      </ToastProvider>
    </LocaleProvider>
  );
}
