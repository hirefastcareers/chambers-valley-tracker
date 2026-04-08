import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const sql = getSql();

  const rows = await sql`
    SELECT
      j.id,
      c.distance_miles
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    WHERE j.mileage_miles IS NULL;
  `;

  let updated = 0;
  let skipped = 0;

  for (const row of rows as Array<{ id: number | string; distance_miles: string | number | null }>) {
    const distanceMiles = Number(row.distance_miles ?? NaN);
    if (!Number.isFinite(distanceMiles)) {
      skipped += 1;
      continue;
    }

    const mileageMiles = Math.round(distanceMiles * 2 * 10) / 10;
    await sql`
      UPDATE jobs
      SET mileage_miles = ${mileageMiles}
      WHERE id = ${Number(row.id)}
        AND mileage_miles IS NULL;
    `;
    updated += 1;
  }

  return NextResponse.json({ updated, skipped });
}

