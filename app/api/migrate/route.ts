import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const sql = getSql();

  await sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS time_of_day VARCHAR(10) DEFAULT 'all_day';
  `;

  return NextResponse.json({ ok: true });
}
