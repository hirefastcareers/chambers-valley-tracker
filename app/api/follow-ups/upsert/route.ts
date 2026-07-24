import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { syncFollowUpPlaceholderJob } from "@/lib/followUpJob";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const customerId = Number(body.customerId);
  const followUpDate = body.followUpDate;
  const notes = typeof body.notes === "string" ? body.notes : "";

  if (!Number.isFinite(customerId) || typeof followUpDate !== "string" || !followUpDate) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const sql = getSql();

  const open = await sql`
    SELECT id, job_id
    FROM follow_ups
    WHERE customer_id = ${customerId}
      AND user_id = ${userId}
      AND completed = false
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  type OpenRow = { id: number | string; job_id: number | string | null };
  const openTyped = open as OpenRow[];
  if (openTyped[0]?.id) {
    const followUpId = Number(openTyped[0].id);
    await sql`
      UPDATE follow_ups
      SET follow_up_date = ${followUpDate}::date,
          notes = ${notes || null},
          completed = false
      WHERE id = ${followUpId}
        AND user_id = ${userId};
    `;
    const { jobId } = await syncFollowUpPlaceholderJob(sql, {
      userId,
      followUpId,
      customerId,
      followUpDateIso: followUpDate,
      notes: notes || null,
      linkedJobId: openTyped[0].job_id,
    });
    if (process.env.DEBUG_FOLLOW_UP_JOBS === "1") {
      console.info("[follow-ups/upsert] synced placeholder job", {
        followUpId,
        customerId,
        jobId,
        date_done: followUpDate,
      });
    }
    return NextResponse.json({
      ok: true,
      updated: true,
      followUpId,
      jobId,
    });
  }

  const rows = await sql`
    INSERT INTO follow_ups (user_id, customer_id, follow_up_date, notes)
    VALUES (${userId}, ${customerId}, ${followUpDate}::date, ${notes || null})
    RETURNING id;
  `;

  type IdRow = { id: number | string };
  const rowsTyped = rows as IdRow[];
  const newFollowUpId = Number(rowsTyped[0].id);
  const { jobId } = await syncFollowUpPlaceholderJob(sql, {
    userId,
    followUpId: newFollowUpId,
    customerId,
    followUpDateIso: followUpDate,
    notes: notes || null,
    linkedJobId: null,
  });
  if (process.env.DEBUG_FOLLOW_UP_JOBS === "1") {
    console.info("[follow-ups/upsert] synced placeholder job", {
      followUpId: newFollowUpId,
      customerId,
      jobId,
      date_done: followUpDate,
    });
  }

  return NextResponse.json({
    ok: true,
    updated: false,
    followUpId: newFollowUpId,
    jobId,
  });
}
