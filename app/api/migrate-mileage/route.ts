import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sql = getSql();
  const url = new URL(req.url);
  const refreshAll =
    url.searchParams.get("refresh") === "1" || url.searchParams.get("all") === "1";

  if (refreshAll) {
    const countRows = await sql`
      WITH u AS (
        UPDATE jobs j
        SET mileage_miles = ROUND((c.distance_miles::numeric * 2)::numeric, 1)
        FROM customers c
        WHERE c.id = j.customer_id
          AND c.distance_miles IS NOT NULL
        RETURNING j.id
      )
      SELECT COUNT(*)::int AS n FROM u;
    `;
    const n = Number((countRows as Array<{ n: number }>)[0]?.n ?? 0);
    return NextResponse.json({ updated: n, skipped: 0, refreshAll: true });
  }

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

