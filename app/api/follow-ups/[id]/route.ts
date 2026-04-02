import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { syncFollowUpPlaceholderJob } from "@/lib/followUpJob";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const { id } = await params;
  const rawId = String(id ?? "");
  const idMatch = rawId.match(/\d+/);
  const idNum = idMatch ? Number(idMatch[0]) : NaN;
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.completed !== "boolean") {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    UPDATE follow_ups
    SET completed = ${body.completed}
    WHERE id = ${idNum};
  `;

  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const { id } = await params;
  const rawId = String(id ?? "");
  const idMatch = rawId.match(/\d+/);
  const idNum = idMatch ? Number(idMatch[0]) : NaN;
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as
    | { followUpDate?: unknown; notes?: unknown; completed?: unknown }
    | null;

  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const followUpDate = typeof body.followUpDate === "string" ? body.followUpDate : "";
  if (!followUpDate) {
    return NextResponse.json({ ok: false, error: "followUpDate is required" }, { status: 400 });
  }

  const notes = typeof body.notes === "string" ? body.notes : "";
  const completed =
    typeof body.completed === "boolean" ? (body.completed as boolean) : null;

  const sql = getSql();
  const followUpRows = await sql`
    SELECT customer_id, job_id
    FROM follow_ups
    WHERE id = ${idNum}
    LIMIT 1;
  `;
  type FollowUpCustomerRow = { customer_id: number | string; job_id: number | string | null };
  const followUpCustomer = (followUpRows as FollowUpCustomerRow[])[0];
  if (!followUpCustomer) {
    return NextResponse.json({ ok: false, error: "Follow-up not found" }, { status: 404 });
  }

  await sql`
    UPDATE follow_ups
    SET follow_up_date = ${followUpDate}::date,
        notes = ${notes || null},
        completed = COALESCE(${completed}::boolean, completed)
    WHERE id = ${idNum};
  `;

  type CompletedRow = { completed: boolean };
  const afterRows = (await sql`
    SELECT completed
    FROM follow_ups
    WHERE id = ${idNum}
    LIMIT 1;
  `) as CompletedRow[];
  if (afterRows[0]?.completed) {
    return NextResponse.json({ ok: true });
  }

  const { jobId } = await syncFollowUpPlaceholderJob(sql, {
    followUpId: idNum,
    customerId: Number(followUpCustomer.customer_id),
    followUpDateIso: followUpDate,
    notes: notes || null,
    linkedJobId: followUpCustomer.job_id,
  });
  if (process.env.DEBUG_FOLLOW_UP_JOBS === "1") {
    console.info("[follow-ups/PUT] synced placeholder job", {
      followUpId: idNum,
      customerId: Number(followUpCustomer.customer_id),
      jobId,
      date_done: followUpDate,
    });
  }

  return NextResponse.json({ ok: true, jobId });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const { id } = await params;
  const rawId = String(id ?? "");
  const idMatch = rawId.match(/\d+/);
  const idNum = idMatch ? Number(idMatch[0]) : NaN;
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    DELETE FROM follow_ups
    WHERE id = ${idNum}
    RETURNING id;
  `;

  return NextResponse.json({ ok: Array.isArray(rows) && rows.length > 0 });
}

