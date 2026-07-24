import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const sql = getSql();

  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE recurring_reminders ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE photos ADD COLUMN IF NOT EXISTS user_id TEXT;`;

  await sql`
    CREATE TABLE IF NOT EXISTS dashboard_notes (
      id BIGSERIAL PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      user_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`ALTER TABLE dashboard_notes ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE photos ADD COLUMN IF NOT EXISTS user_id TEXT;`;

  await sql`CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dashboard_notes_user_id ON dashboard_notes(user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      business_name TEXT,
      trade_type TEXT DEFAULT 'gardening',
      home_postcode TEXT,
      weekly_target INTEGER DEFAULT 350,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_status TEXT DEFAULT 'trialing',
      trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;`;

  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'settings'::regclass
          AND conname = 'settings_pkey'
          AND pg_get_constraintdef(oid) = 'PRIMARY KEY (key)'
      ) THEN
        ALTER TABLE settings DROP CONSTRAINT settings_pkey;
      END IF;
    END
    $$;
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key_user_id ON settings(key, user_id);
  `;

  return NextResponse.json({ ok: true, message: "Multi-tenancy migration complete" });
}
