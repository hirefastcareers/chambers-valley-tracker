import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

async function authorised(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("Authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }
  const cookieStore = await cookies();
  if (cookieStore.get(AUTH_COOKIE)?.value) {
    return true;
  }
  return false;
}

function buildMessage(jobNames: string[], overdueFollowUpCount: number) {
  const jobsLine =
    jobNames.length > 0
      ? `🌿 You have ${jobNames.length} job(s) today — ${jobNames.join(", ")}`
      : "";
  const followUpsLine =
    overdueFollowUpCount > 0
      ? `⚠️ ${overdueFollowUpCount} follow-up(s) overdue — check your dashboard`
      : "";

  const parts = [jobsLine, followUpsLine].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

async function handle(request: Request) {
  if (!(await authorised(request))) {
    return new NextResponse("Unauthorised", { status: 401 });
  }

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !restKey) {
    return NextResponse.json({ ok: false, error: "Missing OneSignal configuration" }, { status: 500 });
  }

  const sql = getSql();

  const [todayJobRows, overdueRows] = await Promise.all([
    sql`
      SELECT c.name AS customer_name
      FROM jobs j
      JOIN customers c ON c.id = j.customer_id
      WHERE j.date_done IS NOT NULL
        AND j.date_done::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date
        AND j.status <> 'completed';
    `,
    sql`
      SELECT COUNT(*)::int AS n
      FROM follow_ups
      WHERE completed = false
        AND follow_up_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date;
    `,
  ]);

  type NameRow = { customer_name: string };
  type CountRow = { n: number };

  const jobNames = (todayJobRows as NameRow[]).map((r) => r.customer_name);
  const overdueCount = Number((overdueRows as CountRow[])[0]?.n ?? 0);

  const message = buildMessage(jobNames, overdueCount);
  if (!message) {
    return NextResponse.json({ ok: true, sent: false, reason: "nothing_to_notify" });
  }

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      Authorization: `Basic ${restKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: appId,
      included_segments: ["All"],
      contents: { en: message },
      headings: { en: "Patch — Good morning 👋" },
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, sent: false, error: "OneSignal request failed", status: res.status, detail: bodyText.slice(0, 500) },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, sent: true, message });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
