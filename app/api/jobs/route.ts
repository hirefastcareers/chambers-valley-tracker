import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { parseAndValidatePhotoPayload } from "@/lib/photoPayload";

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

export async function GET(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const status = (searchParams.get("status") ?? "all").trim();

  const sql = getSql();

  const where =
    status === "all"
      ? sql``
      : isAllowedStatus(status)
        ? sql` WHERE j.status = ${status}`
        : sql``;

  const rows = await sql`
    SELECT
      j.id AS job_id,
      c.name AS customer_name,
      j.job_type,
      j.status,
      j.date_done,
      j.quote_amount,
      j.paid
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    ${where}
    ORDER BY LOWER(TRIM(c.name)) ASC, j.created_at DESC
    LIMIT 200;
  `;

  return NextResponse.json({ jobs: rows });
}

export async function POST(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

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

  const quoteAmount =
    quoteAmountRaw.trim().length === 0 ? null : Number(quoteAmountRaw);

  if (quoteAmount !== null && !Number.isFinite(quoteAmount)) {
    return NextResponse.json({ ok: false, error: "Invalid quote amount" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    INSERT INTO jobs (customer_id, job_type, description, status, quote_amount, paid, date_done)
    VALUES (
      ${customerId},
      ${jobType},
      ${description || null},
      ${statusRaw},
      ${quoteAmount},
      ${paid},
      ${dateDone}::date
    )
    RETURNING id;
  `;

  type InsertRow = { id: number | string };
  const rowsTyped = rows as InsertRow[];
  const jobId = Number(rowsTyped[0].id);

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
        VALUES (${jobId}, ${p.url}, ${p.type}::photo_type);
      `;
    }
  }

  return NextResponse.json({ ok: true, jobId });
}

