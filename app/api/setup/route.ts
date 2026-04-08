import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const sql = getSql();

  // Create enums first.
  await sql`
    DO $$
    BEGIN
      CREATE TYPE job_status AS ENUM ('quoted', 'booked', 'completed', 'needs_follow_up');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END
    $$;
  `;

  await sql`
    DO $$
    BEGIN
      CREATE TYPE photo_type AS ENUM ('before', 'after');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END
    $$;
  `;

  // Customers
  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      distance_miles NUMERIC(6,1),
      phone TEXT,
      email TEXT,
      notes TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // If customers table already exists without tags (older deployments),
  // add the tags column.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'customers'
          AND column_name = 'tags'
      ) THEN
        ALTER TABLE customers ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
      END IF;
    END
    $$;
  `;

  await sql`
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS distance_miles NUMERIC(6,1);
  `;

  // Jobs
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id BIGSERIAL PRIMARY KEY,
      customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      job_type TEXT NOT NULL,
      description TEXT,
      status job_status NOT NULL DEFAULT 'quoted',
      quote_amount NUMERIC,
      paid BOOLEAN NOT NULL DEFAULT false,
      date_done DATE,
      mileage_miles NUMERIC(6,1),
      time_of_day VARCHAR(10) NOT NULL DEFAULT 'all_day',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // If jobs table already exists from an older deployment, add time_of_day.
  await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS time_of_day VARCHAR(10) DEFAULT 'all_day';
  `;

  await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS mileage_miles NUMERIC(6,1);
  `;

  // Follow-ups
  await sql`
    CREATE TABLE IF NOT EXISTS follow_ups (
      id BIGSERIAL PRIMARY KEY,
      customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
      follow_up_date DATE NOT NULL,
      notes TEXT,
      completed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // Recurring reminders
  await sql`
    CREATE TABLE IF NOT EXISTS recurring_reminders (
      id BIGSERIAL PRIMARY KEY,
      customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      job_type TEXT NOT NULL,
      interval_days INTEGER NOT NULL,
      last_done_date DATE,
      next_due_date DATE NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true
    );
  `;

  // Photos
  await sql`
    CREATE TABLE IF NOT EXISTS photos (
      id BIGSERIAL PRIMARY KEY,
      job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      cloudinary_url TEXT NOT NULL,
      type photo_type NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // Helpful indexes
  await sql`
    CREATE INDEX IF NOT EXISTS idx_follow_ups_customer_completed_due
      ON follow_ups (customer_id, completed, follow_up_date);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_recurring_reminders_due
      ON recurring_reminders (active, next_due_date);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_jobs_customer_created_at
      ON jobs (customer_id, created_at);
  `;

  // Quotes
  await sql`
    CREATE TABLE IF NOT EXISTS quotes (
      id BIGSERIAL PRIMARY KEY,
      customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      line_items JSONB NOT NULL,
      total_amount NUMERIC NOT NULL,
      notes TEXT,
      valid_until DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_quotes_customer_created_at
      ON quotes (customer_id, created_at);
  `;

  // Key/value settings (e.g. weekly earnings target)
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

  return NextResponse.json({ ok: true });
}

