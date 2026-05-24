"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminUnsavedOptional } from "@/components/admin/AdminUnsavedChangesProvider";
import { useIntakeNavGuardOptional } from "@/context/IntakeNavGuardContext";
import { RECEIVING_PATH } from "@/lib/auth/paths";

/** Navigate away with admin + intake unsaved prompts (modal, not confirm). */
export function useGuardedNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const adminUnsaved = useAdminUnsavedOptional();
  const intakeGuard = useIntakeNavGuardOptional();

  const navigate = useCallback(
    (href: string, opts?: { alwaysRunLeave?: boolean }) => {
      if (adminUnsaved?.dirty) {
        adminUnsaved.requestNavigation(href);
        return;
      }
      if (intakeGuard?.requestLeave(href, opts?.alwaysRunLeave)) {
        return;
      }
      if (pathname !== href) {
        router.push(href);
      }
    },
    [adminUnsaved, intakeGuard, pathname, router]
  );

  const goToReceiving = useCallback(() => {
    navigate(RECEIVING_PATH, { alwaysRunLeave: true });
  }, [navigate]);

  return { navigate, goToReceiving };
}
