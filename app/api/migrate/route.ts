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

type StepResult = { ok: true } | { ok: false; error: string };

async function runStep(
  name: string,
  results: Record<string, StepResult>,
  fn: () => Promise<void>
) {
  try {
    await fn();
    results[name] = { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[migrate] step "${name}" failed:`, error);
    results[name] = { ok: false, error: message };
  }
}

export async function GET() {
  try {
    const authResult = await requireUserIdApi();
    if (authResult.error) return authResult.error;
    const userId = authResult.userId;

    const sql = getSql();
    const results: Record<string, StepResult> = {};

    await runStep("jobs.time_of_day", results, async () => {
      await sql`
        ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS time_of_day VARCHAR(10) DEFAULT 'all_day';
      `;
    });

    await runStep("settings.table", results, async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(100) PRIMARY KEY,
          value VARCHAR(500) NOT NULL
        );
      `;
    });

    await runStep("settings.user_id_column", results, async () => {
      await sql`
        ALTER TABLE settings
        ADD COLUMN IF NOT EXISTS user_id TEXT;
      `;
    });

    await runStep("settings.weekly_target", results, async () => {
      await sql`
        INSERT INTO settings (key, value, user_id)
        SELECT 'weekly_target', '350', ${userId}
        WHERE NOT EXISTS (
          SELECT 1 FROM settings WHERE key = 'weekly_target' AND user_id = ${userId}
        );
      `;
    });

    await runStep("settings.home_postcode", results, async () => {
      await sql`
        INSERT INTO settings (key, value, user_id)
        SELECT 'home_postcode', 'YOUR_POSTCODE', ${userId}
        WHERE NOT EXISTS (
          SELECT 1 FROM settings WHERE key = 'home_postcode' AND user_id = ${userId}
        );
      `;
    });

    await runStep("customers.distance_miles", results, async () => {
      await sql`
        ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS distance_miles NUMERIC(6,1);
      `;
    });

    await runStep("customers.latitude", results, async () => {
      await sql`
        ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
      `;
    });

    await runStep("customers.longitude", results, async () => {
      await sql`
        ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
      `;
    });

    await runStep("jobs.mileage_miles", results, async () => {
      await sql`
        ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS mileage_miles NUMERIC(6,1);
      `;
    });

    await runStep("jobs.private_notes", results, async () => {
      await sql`
        ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS private_notes TEXT;
      `;
    });

    await runStep("photos.tags", results, async () => {
      await sql`
        ALTER TABLE photos
        ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
      `;
    });

    await runStep("photos.cloudinary_public_id", results, async () => {
      await sql`
        ALTER TABLE photos
        ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;
      `;
    });

    await runStep("users.is_founder", results, async () => {
      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT FALSE;
      `;
    });

    await runStep("job_templates.table", results, async () => {
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
    });

    await runStep("jobs.is_recurring", results, async () => {
      await sql`
        ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
      `;
    });

    await runStep("jobs.recurring_interval_weeks", results, async () => {
      await sql`
        ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS recurring_interval_weeks INTEGER;
      `;
    });

    await runStep("jobs.recurring_parent_id_column", results, async () => {
      await sql`
        ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS recurring_parent_id INTEGER;
      `;
    });

    await runStep("jobs.recurring_parent_id_fkey", results, async () => {
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'jobs'::regclass
              AND conname = 'jobs_recurring_parent_id_fkey'
          ) THEN
            ALTER TABLE jobs
            ADD CONSTRAINT jobs_recurring_parent_id_fkey
            FOREIGN KEY (recurring_parent_id) REFERENCES jobs(id);
          END IF;
        END
        $$;
      `;
    });

    let backfilledFollowUpJobs = 0;
    await runStep("backfillOrphanFollowUpJobs", results, async () => {
      backfilledFollowUpJobs = await backfillOrphanFollowUpJobs(sql, userId);
    });

    const failures = Object.entries(results).filter(([, r]) => !r.ok);
    if (failures.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: failures.map(([name, r]) => `${name}: ${(r as { error: string }).error}`).join("; "),
          results,
          backfilledFollowUpJobs,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, backfilledFollowUpJobs, results });
  } catch (error) {
    console.error("[migrate] error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
