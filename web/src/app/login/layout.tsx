import { LocaleProvider } from "@/context/LocaleContext";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>;
}
