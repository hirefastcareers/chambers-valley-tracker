import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { backfillOrphanFollowUpJobs } from "@/lib/followUpJob";
import { requireUserIdApi } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * After deploying:
 * - Enable Geocoding API in Google Cloud Console
 * - Visit this route (/api/migrate) to add lat/lng columns (and other schema updates)
 * - Visit /api/geocode-customers to geocode all existing customers
 */

export async function GET() {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

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
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
  `;

  await sql`
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
  `;

  await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS mileage_miles NUMERIC(6,1);
  `;

  await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS private_notes TEXT;
  `;

  await sql`
    ALTER TABLE photos
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
  `;

  await sql`
    ALTER TABLE photos
    ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT FALSE;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS job_templates (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      job_type TEXT NOT NULL,
      description TEXT,
      default_amount NUMERIC(10,2),
      time_of_day TEXT DEFAULT 'all_day',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
  `;

  await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS recurring_interval_weeks INTEGER;
  `;

  await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS recurring_parent_id INTEGER REFERENCES jobs(id);
  `;

  const backfilledFollowUpJobs = await backfillOrphanFollowUpJobs(sql, userId);

  return NextResponse.json({ ok: true, backfilledFollowUpJobs });
}
