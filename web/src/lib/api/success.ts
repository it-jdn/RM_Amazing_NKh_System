/** True when an API JSON body indicates a successful mutation. */
export function apiSucceeded(data: { success?: boolean; message?: string }): boolean {
  if (data.success === true) return true;
  const msg = data.message;
  return typeof msg === "string" && msg.startsWith("✅");
}
