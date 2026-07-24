import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { geocodeAddressWithKey } from "@/lib/geocode";

export const runtime = "nodejs";

/**
 * Requires Geocoding API enabled in Google Cloud Console
 * APIs & Services → Library → Geocoding API → Enable
 * Uses the same NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
 *
 * After deploying:
 * - Enable Geocoding API in Google Cloud Console
 * - Visit /api/migrate to add lat/lng columns
 * - Visit this route (/api/geocode-customers) to geocode all existing customers
 */

export async function GET() {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "NEXT_PUBLIC_GOOGLE_PLACES_API_KEY is not configured", geocoded: 0, skipped: 0, errors: 0 },
      { status: 500 }
    );
  }

  const sql = getSql();

  const skippedRows = (await sql`
    SELECT COUNT(*)::int AS n
    FROM customers
    WHERE user_id = ${userId}
      AND latitude IS NULL
      AND (address IS NULL OR TRIM(address) = '');
  `) as Array<{ n: number }>;
  const skipped = Number(skippedRows[0]?.n ?? 0);

  const rows = (await sql`
    SELECT id, address
    FROM customers
    WHERE user_id = ${userId}
      AND latitude IS NULL
      AND address IS NOT NULL
      AND TRIM(address) <> '';
  `) as Array<{ id: number | string | bigint; address: string }>;

  let geocoded = 0;
  let errors = 0;

  for (const r of rows) {
    const id = typeof r.id === "bigint" ? Number(r.id) : Number(r.id);
    const addr = String(r.address ?? "").trim();
    if (!addr) {
      continue;
    }

    try {
      const coords = await geocodeAddressWithKey(addr, apiKey);
      if (!coords) {
        errors += 1;
        continue;
      }
      await sql`
        UPDATE customers
        SET latitude = ${coords.lat}, longitude = ${coords.lng}
        WHERE id = ${id}
          AND user_id = ${userId};
      `;
      geocoded += 1;
    } catch {
      errors += 1;
    }
  }

  return NextResponse.json({ ok: true, geocoded, skipped, errors });
}
