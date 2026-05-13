import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_OFF_MESSAGE = "No jobs scheduled today — enjoy the day off! 🌿";

function bearerFromRequest(request: Request): string | null {
  const raw = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!raw) return null;
  const m = raw.match(/^\s*Bearer\s+(\S+)\s*$/i);
  return m?.[1] ?? null;
}

async function authorised(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const token = bearerFromRequest(request)?.trim();
  if (cronSecret && token === cronSecret) {
    return true;
  }
  const cookieStore = await cookies();
  if (cookieStore.get(AUTH_COOKIE)?.value) {
    return true;
  }
  return false;
}

function patchHeadingLondon(): string {
  const d = new Date();
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/London" }).format(d);
  const dayNum = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "Europe/London" }).format(d);
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "Europe/London" }).format(d);
  return `Patch · ${weekday} ${dayNum} ${month}`;
}

function firstName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return "Customer";
  return (t.split(/\s+/)[0] ?? t).replace(/^[,;.]+/, "");
}

/** AM/PM suffix for jobs; `all_day` (or unknown) → name only. */
function formatJobNameWithTime(customerName: string, timeOfDay: string | null | undefined): string {
  const name = firstName(customerName);
  const slot = (timeOfDay ?? "all_day").toLowerCase();
  if (slot === "am") return `${name} (AM)`;
  if (slot === "pm") return `${name} (PM)`;
  return name;
}

function formatDigestTotalPounds(total: number): string {
  if (!Number.isFinite(total)) return "£0";
  const rounded = Math.round(total * 100) / 100;
  if (Number.isInteger(rounded)) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(rounded);
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

type JobRow = {
  customer_name: string;
  quote_amount: string | number | null;
  time_of_day: string | null;
};

type FollowOverdueRow = { customer_name: string; days_overdue: number | string };

function parseQuote(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatJobsSection(jobs: JobRow[]): string | null {
  if (jobs.length === 0) return null;

  const totalQuoted = jobs.reduce((sum, j) => {
    const q = parseQuote(j.quote_amount);
    return q !== null ? sum + q : sum;
  }, 0);

  const hasAnyQuote = jobs.some((j) => parseQuote(j.quote_amount) !== null);

  const jobWord = jobs.length === 1 ? "job" : "jobs";
  let headline = `${jobs.length} ${jobWord} today`;
  if (hasAnyQuote && totalQuoted > 0) {
    headline += ` · ${formatDigestTotalPounds(totalQuoted)}`;
  }

  const details = jobs.map((j) => formatJobNameWithTime(j.customer_name, j.time_of_day)).join(" · ");

  return `${headline} — ${details}`;
}

function formatFollowUpsSection(rows: FollowOverdueRow[]): string | null {
  if (rows.length === 0) return null;

  const word = rows.length === 1 ? "follow-up" : "follow-ups";
  const details = rows
    .map((r) => {
      const days = typeof r.days_overdue === "string" ? Number(r.days_overdue) : Number(r.days_overdue);
      const safeDays = Number.isFinite(days) ? days : 0;
      const unit = safeDays === 1 ? "day" : "days";
      return `${firstName(r.customer_name)} (${safeDays} ${unit})`;
    })
    .join(" · ");

  return `${rows.length} ${word} overdue — ${details}`;
}

function buildBody(jobs: JobRow[], followUps: FollowOverdueRow[]): string {
  const jobsLine = formatJobsSection(jobs);
  const followLine = formatFollowUpsSection(followUps);

  if (jobsLine && followLine) {
    return `${jobsLine}\n${followLine}`;
  }
  if (jobsLine) return jobsLine;
  if (followLine) return followLine;
  return DAY_OFF_MESSAGE;
}

async function handle(request: Request) {
  if (!(await authorised(request))) {
    console.warn("[cron] send-daily-notifications unauthorised", {
      at: new Date().toISOString(),
      method: request.method,
      hasBearer: Boolean(bearerFromRequest(request)),
      hasCronSecretEnv: Boolean(process.env.CRON_SECRET?.trim()),
    });
    return new NextResponse("Unauthorised", { status: 401 });
  }

  console.log("[cron] send-daily-notifications called at", new Date().toISOString());

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !restKey) {
    console.error("[cron] Missing OneSignal configuration (NEXT_PUBLIC_ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY)");
    return NextResponse.json({ ok: false, error: "Missing OneSignal configuration" }, { status: 500 });
  }

  const sql = getSql();

  const [todayJobRows, overdueDetailRows] = await Promise.all([
    sql`
      SELECT
        c.name AS customer_name,
        j.quote_amount AS quote_amount,
        j.time_of_day AS time_of_day
      FROM jobs j
      JOIN customers c ON c.id = j.customer_id
      WHERE j.date_done IS NOT NULL
        AND j.date_done::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date
        AND j.status <> 'completed'
      ORDER BY j.date_done ASC, j.created_at ASC;
    `,
    sql`
      SELECT
        c.name AS customer_name,
        (
          (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date
          - f.follow_up_date
        )::int AS days_overdue
      FROM follow_ups f
      JOIN customers c ON c.id = f.customer_id
      WHERE f.completed = false
        AND f.follow_up_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date
      ORDER BY f.follow_up_date ASC;
    `,
  ]);

  const jobsToday = todayJobRows as JobRow[];
  const overdueFollowUps = overdueDetailRows as FollowOverdueRow[];

  console.log("[cron] jobs today:", jobsToday.length);
  console.log("[cron] overdue follow-ups:", overdueFollowUps.length);

  const message = buildBody(jobsToday, overdueFollowUps);
  const heading = patchHeadingLondon();

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
      headings: { en: heading },
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    console.error("[cron] OneSignal request failed", { status: res.status, detail: bodyText.slice(0, 500) });
    return NextResponse.json(
      { ok: false, sent: false, error: "OneSignal request failed", status: res.status, detail: bodyText.slice(0, 500) },
      { status: 502 }
    );
  }

  console.log("[cron] OneSignal OK, digest length:", message.length);
  return NextResponse.json({ ok: true, sent: true, message, heading });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
