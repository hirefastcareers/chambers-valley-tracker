import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSql } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Fill jobs.mileage_miles (return trip = 2 × customer one-way miles) for any job
 * whose mileage is still null. No filter on job.status — quoted, booked, completed, etc. all included.
 * Rows stay null only when the customer has no usable distance_miles (null / missing).
 */
export async function GET(req: Request) {
  const sql = getSql();
  const url = new URL(req.url);
  const refreshAll =
    url.searchParams.get("refresh") === "1" || url.searchParams.get("all") === "1";
  const diagnostic = url.searchParams.get("diagnostic") === "1";

  if (diagnostic) {
    const authRes = await requireAuthApi();
    if (authRes) return authRes;

    const jobsWithoutMileage = (await sql`
      SELECT j.id, j.status, j.date_done, j.mileage_miles,
             c.id AS customer_id, c.name, c.distance_miles
      FROM jobs j
      JOIN customers c ON j.customer_id = c.id
      WHERE j.mileage_miles IS NULL
      ORDER BY c.name, j.date_done NULLS LAST, j.id;
    `) as Array<Record<string, unknown>>;

    const customersMissingDistance = (await sql`
      SELECT id, name, address, distance_miles
      FROM customers
      WHERE distance_miles IS NULL OR distance_miles = 0;
    `) as Array<Record<string, unknown>>;

    return NextResponse.json({
      diagnostic: true,
      jobsWithNullMileage: jobsWithoutMileage,
      jobsWithNullMileageCount: jobsWithoutMileage.length,
      customersWithNullOrZeroDistance: customersMissingDistance,
      customersWithNullOrZeroDistanceCount: customersMissingDistance.length,
    });
  }

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

  const updateRows = await sql`
    WITH u AS (
      UPDATE jobs j
      SET mileage_miles = ROUND((c.distance_miles::numeric * 2)::numeric, 1)
      FROM customers c
      WHERE c.id = j.customer_id
        AND j.mileage_miles IS NULL
        AND c.distance_miles IS NOT NULL
      RETURNING j.id
    )
    SELECT COUNT(*)::int AS updated FROM u;
  `;

  const updated = Number((updateRows as Array<{ updated: number }>)[0]?.updated ?? 0);

  const skippedRows = await sql`
    SELECT COUNT(*)::int AS skipped
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    WHERE j.mileage_miles IS NULL;
  `;
  const skipped = Number((skippedRows as Array<{ skipped: number }>)[0]?.skipped ?? 0);

  return NextResponse.json({ updated, skipped });
}
