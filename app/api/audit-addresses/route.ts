import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
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

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const sql = getSql();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  const rows = (await sql`
    SELECT id, name, address, latitude, longitude
    FROM customers
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

    // Address present but missing coordinates — attempt geocode
    if (apiKey) {
      try {
        const coords = await geocodeAddressWithKey(address, apiKey);
        if (coords) {
          await sql`
            UPDATE customers
            SET latitude = ${coords.lat}, longitude = ${coords.lng}
            WHERE id = ${id};
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
