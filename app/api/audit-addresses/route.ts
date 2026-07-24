import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { geocodeAddressWithKey } from "@/lib/geocode";

export const runtime = "nodejs";

type CustomerRow = {
  id: number | string | bigint;
  name: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
};

type AddressIssue = {
  id: number;
  name: string;
  address: string | null;
  issue: string;
};

export async function GET() {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const sql = getSql();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  const rows = (await sql`
    SELECT id, name, address, latitude, longitude
    FROM customers
    WHERE user_id = ${userId}
    ORDER BY name ASC NULLS LAST, id ASC;
  `) as CustomerRow[];

  const issues: AddressIssue[] = [];
  let geocoded = 0;
  let geocodeErrors = 0;

  for (const r of rows) {
    const id = typeof r.id === "bigint" ? Number(r.id) : Number(r.id);
    const name = String(r.name ?? "").trim() || `Customer #${id}`;
    const address = r.address != null ? String(r.address).trim() : "";
    const hasAddress = address.length > 0;
    const lat = r.latitude == null || r.latitude === "" ? null : Number(r.latitude);
    const lng = r.longitude == null || r.longitude === "" ? null : Number(r.longitude);
    const hasCoords = lat != null && Number.isFinite(lat) && lng != null && Number.isFinite(lng);

    if (!hasAddress) {
      issues.push({ id, name, address: null, issue: "No address" });
      continue;
    }

    if (hasCoords) continue;

    if (apiKey) {
      try {
        const coords = await geocodeAddressWithKey(address, apiKey);
        if (coords) {
          await sql`
            UPDATE customers
            SET latitude = ${coords.lat}, longitude = ${coords.lng}
            WHERE id = ${id}
              AND user_id = ${userId};
          `;
          geocoded += 1;
          continue;
        }
        geocodeErrors += 1;
      } catch {
        geocodeErrors += 1;
      }
    }

    issues.push({ id, name, address, issue: "Not geocoded" });
  }

  const total_customers = rows.length;
  const verified = total_customers - issues.length;

  return NextResponse.json({
    ok: true,
    total_customers,
    verified,
    issues,
    geocoded,
    geocode_errors: geocodeErrors,
  });
}
