import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { parseAndValidatePhotoPayload } from "@/lib/photoPayload";
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

function isAllowedStatus(value: string): value is "quoted" | "booked" | "completed" | "needs_follow_up" {
  return ["quoted", "booked", "completed", "needs_follow_up"].includes(value);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

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
      status,
      quote_amount,
      paid,
      date_done
    FROM jobs
    WHERE id = ${idNum}
    LIMIT 1;
  `;

  type JobRow = {
    id: number | string;
    customer_id: number | string;
    job_type: string;
    description: string | null;
    status: "quoted" | "booked" | "completed" | "needs_follow_up";
    quote_amount: string | number | null;
    paid: boolean;
    date_done: string | null;
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
      status: job.status,
      quoteAmount: job.quote_amount,
      paid: Boolean(job.paid),
      dateDone: job.date_done,
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const formData = await req.formData();

  const customerId = Number(formData.get("customerId"));
  const jobType = String(formData.get("jobType") ?? "");
  const description = String(formData.get("description") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const quoteAmountRaw = String(formData.get("quoteAmount") ?? "");
  const paid = String(formData.get("paid") ?? "false") === "true";
  const dateDone = String(formData.get("dateDone") ?? "");

  if (!Number.isFinite(customerId) || !jobType || !dateDone || !isAllowedStatus(statusRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const quoteAmount = quoteAmountRaw.trim().length === 0 ? null : Number(quoteAmountRaw);
  if (quoteAmount !== null && !Number.isFinite(quoteAmount)) {
    return NextResponse.json({ ok: false, error: "Invalid quote amount" }, { status: 400 });
  }

  const sql = getSql();
  const updateRows = await sql`
    UPDATE jobs
    SET
      customer_id = ${customerId},
      job_type = ${jobType},
      description = ${description || null},
      status = ${statusRaw},
      quote_amount = ${quoteAmount},
      paid = ${paid},
      date_done = ${dateDone}::date
    WHERE id = ${idNum}
    RETURNING id;
  `;

  type UpdateRow = { id: number | string };
  const updateTyped = updateRows as UpdateRow[];
  const updatedIdRaw = updateTyped[0]?.id;
  const updatedId = updatedIdRaw === undefined || updatedIdRaw === null ? NaN : Number(updatedIdRaw);
  if (!Number.isFinite(updatedId)) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  // Optional: new photos uploaded from the client (unsigned Cloudinary), then URLs sent here.
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
        INSERT INTO photos (job_id, cloudinary_url, type)
        VALUES (${idNum}, ${p.url}, ${p.type}::photo_type);
      `;
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    DELETE FROM jobs
    WHERE id = ${idNum}
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

