/** First segment of address (e.g. "Chapeltown" from "Chapeltown, Sheffield"). */
export function customerAreaFromAddress(address: string | null | undefined): string {
  if (!address?.trim()) return "Sheffield";
  const comma = address.split(",")[0]?.trim() ?? "";
  if (comma.length > 0) return comma;
  const line = address.split("\n")[0]?.trim() ?? "";
  return line.length > 0 ? line : "Sheffield";
}
