import { geocodeAddressWithKey } from "@/lib/geocode";

type Sql = ReturnType<typeof import("@/lib/db").getSql>;

/** Updates latitude / longitude for a customer from their address (or clears when empty). */
export async function syncCustomerGeocode(sql: Sql, customerId: number, address: string | null): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) return;

  if (!address?.trim()) {
    await sql`
      UPDATE customers
      SET latitude = NULL, longitude = NULL
      WHERE id = ${customerId};
    `;
    return;
  }

  const coords = await geocodeAddressWithKey(address.trim(), apiKey);
  if (!coords) return;

  await sql`
    UPDATE customers
    SET latitude = ${coords.lat}, longitude = ${coords.lng}
    WHERE id = ${customerId};
  `;
}
