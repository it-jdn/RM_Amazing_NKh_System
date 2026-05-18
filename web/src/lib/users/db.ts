import type { AppRole } from "@/lib/types";
import { buildDisplayName, sanitizeUserNamePart } from "@/lib/users/display-name";

export type AppUserRow = {
  id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email: string;
  role: AppRole;
  active: boolean;
  created_at: string;
  updated_at?: string;
};

export type AppUserPublic = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  displayName: string;
  role: AppRole;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

export function mapUserRow(row: AppUserRow): AppUserPublic {
  const firstName = sanitizeUserNamePart(row.first_name || "");
  const lastName = sanitizeUserNamePart(row.last_name || "");
  return {
    id: row.id,
    firstName,
    lastName,
    email: row.email?.trim() || "",
    displayName: buildDisplayName(firstName, lastName) || row.display_name,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
