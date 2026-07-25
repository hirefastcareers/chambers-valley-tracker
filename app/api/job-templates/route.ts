import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

function isAllowedTimeOfDay(value: string): value is "am" | "pm" | "all_day" {
  return value === "am" || value === "pm" || value === "all_day";
}

export async function GET() {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const sql = getSql();
  const rows = await sql`
    SELECT id, name, job_type, description, default_amount, time_of_day, created_at
    FROM job_templates
    WHERE user_id = ${userId}
    ORDER BY name ASC;
  `;

  return NextResponse.json({ ok: true, templates: rows });
}

export async function POST(req: Request) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const jobType = String(body.job_type ?? body.jobType ?? "").trim();
  const description = String(body.description ?? "").trim();
  const timeOfDayRaw = String(body.time_of_day ?? body.timeOfDay ?? "all_day");
  const defaultAmountRaw = body.default_amount ?? body.defaultAmount ?? null;

  if (!name || !jobType || !isAllowedTimeOfDay(timeOfDayRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  let defaultAmount: number | null = null;
  if (defaultAmountRaw !== null && defaultAmountRaw !== undefined && String(defaultAmountRaw).trim() !== "") {
    defaultAmount = Number(defaultAmountRaw);
    if (!Number.isFinite(defaultAmount)) {
      return NextResponse.json({ ok: false, error: "Invalid default amount" }, { status: 400 });
    }
  }

  const sql = getSql();
  const rows = await sql`
    INSERT INTO job_templates (user_id, name, job_type, description, default_amount, time_of_day)
    VALUES (
      ${userId},
      ${name},
      ${jobType},
      ${description || null},
      ${defaultAmount},
      ${timeOfDayRaw}
    )
    RETURNING id, name, job_type, description, default_amount, time_of_day, created_at;
  `;

  return NextResponse.json({ ok: true, template: (rows as unknown[])[0] });
}
