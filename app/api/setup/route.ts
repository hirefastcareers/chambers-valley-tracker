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
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
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

  return NextResponse.json({ ok: true });
}

