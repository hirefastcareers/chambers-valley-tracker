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

function isAllowedTimeOfDay(value: string): value is "am" | "pm" | "all_day" {
  return value === "am" || value === "pm" || value === "all_day";
}

export async function GET(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const status = (searchParams.get("status") ?? "all").trim();
  const timeOfDay = (searchParams.get("time_of_day") ?? "all").trim();
  const offsetRaw = Number(searchParams.get("offset") ?? 0);
  const limitRaw = Number(searchParams.get("limit") ?? 20);
  const sort = (searchParams.get("sort") ?? "date_done").trim();
  const explicitOrder = (searchParams.get("order") ?? "").trim().toLowerCase();
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 20;

  const sql = getSql();

  const hasStatusFilter = status !== "all" && isAllowedStatus(status);
  const hasTimeFilter = timeOfDay !== "all" && isAllowedTimeOfDay(timeOfDay);

  let where = sql``;
  if (hasStatusFilter && hasTimeFilter) {
    where = sql`WHERE j.status = ${status} AND j.time_of_day = ${timeOfDay}`;
  } else if (hasStatusFilter) {
    where = sql`WHERE j.status = ${status}`;
  } else if (hasTimeFilter) {
    where = sql`WHERE j.time_of_day = ${timeOfDay}`;
  }
  const order =
    explicitOrder === "asc" || explicitOrder === "desc"
      ? explicitOrder
      : status === "quoted" || status === "booked"
        ? "asc"
        : "desc";

  const countRows = await sql`
    SELECT COUNT(*)::int AS total
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    ${where};
  `;

  type JobListRow = {
    job_id: number | string;
    customer_id: number | string;
    customer_name: string;
    job_type: string;
    description: string | null;
    status: "quoted" | "booked" | "completed" | "needs_follow_up";
    date_done: string | null;
    time_of_day: "am" | "pm" | "all_day" | null;
    quote_amount: string | number | null;
    paid: boolean;
    mileage_miles: string | number | null;
  };

  const rowsRaw =
    sort === "date_done" && order === "asc"
      ? await sql`
          SELECT
            j.id AS job_id,
            j.customer_id,
            c.name AS customer_name,
            j.job_type,
            j.description,
            j.status,
            j.date_done,
            j.time_of_day,
            j.quote_amount,
            j.paid,
            j.mileage_miles
          FROM jobs j
          JOIN customers c ON c.id = j.customer_id
          ${where}
          ORDER BY j.date_done ASC NULLS LAST, j.created_at ASC
          LIMIT ${limit}
          OFFSET ${offset};
        `
      : await sql`
          SELECT
            j.id AS job_id,
            j.customer_id,
            c.name AS customer_name,
            j.job_type,
            j.description,
            j.status,
            j.date_done,
            j.time_of_day,
            j.quote_amount,
            j.paid,
            j.mileage_miles
          FROM jobs j
          JOIN customers c ON c.id = j.customer_id
          ${where}
          ORDER BY j.date_done DESC NULLS LAST, j.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset};
        `;
  const rows = rowsRaw as JobListRow[];

  type CountRow = { total: number | string };
  const total = Number((countRows as CountRow[])[0]?.total ?? 0);
  const hasMore = offset + rows.length < total;

  return NextResponse.json({ jobs: rows, total, hasMore, offset, limit });
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
  const timeOfDayRaw = String(formData.get("timeOfDay") ?? "all_day");
  const mileageMilesRaw = String(formData.get("mileageMiles") ?? "");

  if (!Number.isFinite(customerId) || !jobType || !dateDone || !isAllowedStatus(statusRaw) || !isAllowedTimeOfDay(timeOfDayRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const quoteAmount =
    quoteAmountRaw.trim().length === 0 ? null : Number(quoteAmountRaw);

  if (quoteAmount !== null && !Number.isFinite(quoteAmount)) {
    return NextResponse.json({ ok: false, error: "Invalid quote amount" }, { status: 400 });
  }

  let mileageMiles: number | null = mileageMilesRaw.trim().length === 0 ? null : Number(mileageMilesRaw);
  if (mileageMiles !== null && !Number.isFinite(mileageMiles)) {
    return NextResponse.json({ ok: false, error: "Invalid mileage" }, { status: 400 });
  }

  const sql = getSql();
  if (mileageMiles === null) {
    const customerRows = await sql`
      SELECT distance_miles
      FROM customers
      WHERE id = ${customerId}
      LIMIT 1;
    `;
    const oneWayMiles = Number((customerRows as Array<{ distance_miles: string | number | null }>)[0]?.distance_miles ?? NaN);
    mileageMiles = Number.isFinite(oneWayMiles) ? Math.round(oneWayMiles * 2 * 10) / 10 : null;
  }

  const rows = await sql`
    INSERT INTO jobs (customer_id, job_type, description, status, quote_amount, paid, date_done, mileage_miles, time_of_day)
    VALUES (
      ${customerId},
      ${jobType},
      ${description || null},
      ${statusRaw},
      ${quoteAmount},
      ${paid},
      ${dateDone}::date,
      ${mileageMiles},
      ${timeOfDayRaw}
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

