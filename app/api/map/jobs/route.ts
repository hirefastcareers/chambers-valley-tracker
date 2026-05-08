import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { addDaysLocal, parseYmdLocal, toYmdLocal } from "@/lib/ukTaxYearWeeks";

export const runtime = "nodejs";

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const url = new URL(req.url);
  const weekStartRaw = (url.searchParams.get("week_start") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid or missing week_start (YYYY-MM-DD)" }, { status: 400 });
  }

  const monday = parseYmdLocal(weekStartRaw);
  const sunday = addDaysLocal(monday, 6);
  const weekEndStr = toYmdLocal(sunday);

  const sql = getSql();
  const rows = await sql`
    SELECT
      j.id AS job_id,
      c.id AS customer_id,
      c.name AS customer_name,
      j.job_type,
      j.date_done::text AS date_done,
      j.time_of_day,
      j.quote_amount,
      c.latitude,
      c.longitude
    FROM jobs j
    INNER JOIN customers c ON c.id = j.customer_id
    WHERE j.date_done IS NOT NULL
      AND j.date_done >= ${weekStartRaw}::date
      AND j.date_done <= ${weekEndStr}::date
      AND c.latitude IS NOT NULL
      AND c.longitude IS NOT NULL
    ORDER BY j.date_done ASC, j.created_at ASC;
  `;

  type Row = {
    job_id: number | string | bigint;
    customer_id: number | string | bigint;
    customer_name: string;
    job_type: string;
    date_done: string;
    time_of_day: "am" | "pm" | "all_day" | string | null;
    quote_amount: string | number | null;
    latitude: string | number;
    longitude: string | number;
  };

  const jobs = (rows as Row[]).map((r) => ({
    job_id: Number(r.job_id),
    customer_id: Number(r.customer_id),
    customer_name: r.customer_name,
    job_type: r.job_type,
    date_done: String(r.date_done).split("T")[0] ?? "",
    time_of_day: r.time_of_day,
    quote_amount: r.quote_amount,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
  }));

  return NextResponse.json({
    ok: true,
    week_start: weekStartRaw,
    week_end: weekEndStr,
    jobs,
  });
}
