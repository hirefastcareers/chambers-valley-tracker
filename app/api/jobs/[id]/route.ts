import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { parseAndValidatePhotoPayload } from "@/lib/photoPayload";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function isAllowedStatus(value: string): value is "quoted" | "booked" | "completed" | "needs_follow_up" {
  return ["quoted", "booked", "completed", "needs_follow_up"].includes(value);
}

function isAllowedTimeOfDay(value: string): value is "am" | "pm" | "all_day" {
  return value === "am" || value === "pm" || value === "all_day";
}

function syncStatusAndPaid(
  status: "quoted" | "booked" | "completed" | "needs_follow_up",
  paid: boolean
): { status: "quoted" | "booked" | "completed" | "needs_follow_up"; paid: boolean } {
  if (status === "completed") {
    return { status: "completed", paid: true };
  }
  if (paid) {
    return { status: "completed", paid: true };
  }
  return { status, paid: false };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const { id } = await params;
  const rawId = String(id ?? "");
  const idNum = Number(rawId);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      customer_id,
      job_type,
      description,
      private_notes,
      status,
      quote_amount,
      paid,
      date_done,
      mileage_miles,
      time_of_day,
      is_recurring,
      recurring_interval_weeks,
      recurring_parent_id
    FROM jobs
    WHERE id = ${idNum}
      AND user_id = ${userId}
    LIMIT 1;
  `;

  type JobRow = {
    id: number | string;
    customer_id: number | string;
    job_type: string;
    description: string | null;
    private_notes: string | null;
    status: "quoted" | "booked" | "completed" | "needs_follow_up";
    quote_amount: string | number | null;
    paid: boolean;
    date_done: string | null;
    mileage_miles: string | number | null;
    time_of_day: "am" | "pm" | "all_day" | null;
    is_recurring: boolean | null;
    recurring_interval_weeks: number | string | null;
    recurring_parent_id: number | string | null;
  };

  const rowsTyped = rows as JobRow[];
  const job = rowsTyped[0];
  if (!job) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    job: {
      id: Number(job.id),
      customerId: Number(job.customer_id),
      jobType: job.job_type,
      description: job.description,
      privateNotes: job.private_notes,
      status: job.status,
      quoteAmount: job.quote_amount,
      paid: Boolean(job.paid),
      dateDone: job.date_done,
      mileageMiles: job.mileage_miles,
      timeOfDay: isAllowedTimeOfDay(String(job.time_of_day ?? "")) ? String(job.time_of_day) : "all_day",
      isRecurring: Boolean(job.is_recurring),
      recurringIntervalWeeks:
        job.recurring_interval_weeks == null ? null : Number(job.recurring_interval_weeks),
      recurringParentId: job.recurring_parent_id == null ? null : Number(job.recurring_parent_id),
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const formData = await req.formData();

  const customerId = Number(formData.get("customerId"));
  const jobType = String(formData.get("jobType") ?? "");
  const description = String(formData.get("description") ?? "");
  const privateNotes = String(formData.get("privateNotes") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const quoteAmountRaw = String(formData.get("quoteAmount") ?? "");
  const paid = String(formData.get("paid") ?? "false") === "true";
  const dateDone = String(formData.get("dateDone") ?? "");
  const timeOfDayRaw = String(formData.get("timeOfDay") ?? "all_day");
  const mileageMilesRaw = String(formData.get("mileageMiles") ?? "");
  const isRecurring = String(formData.get("isRecurring") ?? "false") === "true";
  const recurringIntervalWeeksRaw = String(formData.get("recurringIntervalWeeks") ?? "");

  if (!Number.isFinite(customerId) || !jobType || !dateDone || !isAllowedStatus(statusRaw) || !isAllowedTimeOfDay(timeOfDayRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const synced = syncStatusAndPaid(statusRaw, paid);

  let recurringIntervalWeeks: number | null = null;
  if (isRecurring) {
    recurringIntervalWeeks = Number(recurringIntervalWeeksRaw);
    if (!Number.isFinite(recurringIntervalWeeks) || recurringIntervalWeeks <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid recurring interval" }, { status: 400 });
    }
  }

  const quoteAmount = quoteAmountRaw.trim().length === 0 ? null : Number(quoteAmountRaw);
  if (quoteAmount !== null && !Number.isFinite(quoteAmount)) {
    return NextResponse.json({ ok: false, error: "Invalid quote amount" }, { status: 400 });
  }

  const mileageMiles = mileageMilesRaw.trim().length === 0 ? null : Number(mileageMilesRaw);
  if (mileageMiles !== null && !Number.isFinite(mileageMiles)) {
    return NextResponse.json({ ok: false, error: "Invalid mileage" }, { status: 400 });
  }

  const sql = getSql();
  const updateRows = await sql`
    UPDATE jobs
    SET
      customer_id = ${customerId},
      job_type = ${jobType},
      description = ${description || null},
      private_notes = ${privateNotes || null},
      status = ${synced.status},
      quote_amount = ${quoteAmount},
      paid = ${synced.paid},
      date_done = ${dateDone}::date,
      mileage_miles = ${mileageMiles},
      time_of_day = ${timeOfDayRaw},
      is_recurring = ${isRecurring},
      recurring_interval_weeks = ${recurringIntervalWeeks}
    WHERE id = ${idNum}
      AND user_id = ${userId}
    RETURNING id;
  `;

  type UpdateRow = { id: number | string };
  const updateTyped = updateRows as UpdateRow[];
  const updatedIdRaw = updateTyped[0]?.id;
  const updatedId = updatedIdRaw === undefined || updatedIdRaw === null ? NaN : Number(updatedIdRaw);
  if (!Number.isFinite(updatedId)) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const photoPayloadRaw = formData.get("photoPayload");
  if (typeof photoPayloadRaw === "string" && photoPayloadRaw.trim().length > 0) {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
    if (!cloudName) {
      return NextResponse.json(
        { ok: false, error: "Server misconfiguration: missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME" },
        { status: 500 }
      );
    }

    const parsed = parseAndValidatePhotoPayload(photoPayloadRaw, cloudName);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    for (const p of parsed.items) {
      await sql`
        INSERT INTO photos (user_id, job_id, cloudinary_url, type, tags, cloudinary_public_id)
        VALUES (${userId}, ${idNum}, ${p.url}, ${p.type}::photo_type, ${p.tags}::text[], ${p.cloudinaryPublicId});
      `;
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    DELETE FROM jobs
    WHERE id = ${idNum}
      AND user_id = ${userId}
    RETURNING id;
  `;

  type DeleteRow = { id: number | string };
  const rowsTyped = rows as DeleteRow[];
  const deletedIdRaw = rowsTyped[0]?.id;
  const deletedId = deletedIdRaw === undefined || deletedIdRaw === null ? NaN : Number(deletedIdRaw);
  if (!Number.isFinite(deletedId)) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
