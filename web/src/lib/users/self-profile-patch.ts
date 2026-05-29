import { buildDisplayName, sanitizeUserNamePart } from "@/lib/users/display-name";

/** Fields a signed-in user may change on their own account (not role/PIN/active). */
export function buildSelfProfilePatch(body: Record<string, unknown>): {
  patch: Record<string, unknown>;
  error?: string;
} {
  const patch: Record<string, unknown> = {};

  if (body.firstName !== undefined) {
    const firstName = sanitizeUserNamePart(String(body.firstName));
    if (!firstName) return { patch, error: "กรุณากรอกชื่อ" };
    patch.first_name = firstName;
  }
  if (body.lastName !== undefined) {
    patch.last_name = sanitizeUserNamePart(String(body.lastName));
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!email) return { patch, error: "กรุณากรอกอีเมล" };
    patch.email = email;
  }

  return { patch };
}

export function withDisplayNameFromNameParts(
  patch: Record<string, unknown>,
  current: { first_name?: string | null; last_name?: string | null }
): Record<string, unknown> {
  if (patch.first_name === undefined && patch.last_name === undefined) return patch;

  const first = sanitizeUserNamePart(
    String(patch.first_name ?? current.first_name ?? "")
  );
  const last = sanitizeUserNamePart(String(patch.last_name ?? current.last_name ?? ""));
  return { ...patch, display_name: buildDisplayName(first, last) };
}
