import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

function isAllowedTimeOfDay(value: string): value is "am" | "pm" | "all_day" {
  return value === "am" || value === "pm" || value === "all_day";
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

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
    UPDATE job_templates
    SET
      name = ${name},
      job_type = ${jobType},
      description = ${description || null},
      default_amount = ${defaultAmount},
      time_of_day = ${timeOfDayRaw}
    WHERE id = ${idNum}
      AND user_id = ${userId}
    RETURNING id;
  `;

  if (!(rows as unknown[]).length) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    DELETE FROM job_templates
    WHERE id = ${idNum}
      AND user_id = ${userId}
    RETURNING id;
  `;

  if (!(rows as unknown[]).length) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
