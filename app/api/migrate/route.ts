import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { backfillOrphanFollowUpJobs } from "@/lib/followUpJob";

export const runtime = "nodejs";

export async function GET() {
  const sql = getSql();

  await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS time_of_day VARCHAR(10) DEFAULT 'all_day';
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(100) PRIMARY KEY,
      value VARCHAR(500) NOT NULL
    );
  `;

  await sql`
    INSERT INTO settings (key, value)
    VALUES ('weekly_target', '350')
    ON CONFLICT (key) DO NOTHING;
  `;

  await sql`
    INSERT INTO settings (key, value)
    VALUES ('home_postcode', 'YOUR_POSTCODE')
    ON CONFLICT (key) DO NOTHING;
  `;

  await sql`
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS distance_miles NUMERIC(6,1);
  `;

  await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS mileage_miles NUMERIC(6,1);
  `;

  const backfilledFollowUpJobs = await backfillOrphanFollowUpJobs(sql);

  return NextResponse.json({ ok: true, backfilledFollowUpJobs });
}
