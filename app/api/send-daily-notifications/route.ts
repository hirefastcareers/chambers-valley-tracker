import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

const DAY_OFF_MESSAGE = "No jobs scheduled today — enjoy the day off! 🌿";

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

/** UK outward+inward pattern (simplified); used to drop postcode segments. */
const UK_POSTCODE_SEGMENT = /^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/i;

const GENERIC_LOCATION_SEGMENTS = new Set(["sheffield", "south yorkshire"]);

function isPostcodeSegment(segment: string): boolean {
  return UK_POSTCODE_SEGMENT.test(segment.trim());
}

/** Remove optional leading house number (e.g. "71 " or "12A ") for display as area/street label. */
function stripLeadingHouseNumber(segment: string): string {
  const t = segment.trim();
  const without = t.replace(/^\d+[A-Za-z]?\s+/, "").trim();
  return without || t;
}

/** First comma-separated segment that is not purely numeric (house number only). */
function firstNonNumericSegment(segments: string[]): string {
  for (const seg of segments) {
    const t = seg.trim();
    if (!t) continue;
    if (/^\d+$/.test(t)) continue;
    return stripLeadingHouseNumber(t);
  }
  return "";
}

/**
 * Prefer town/area: last comma segment after dropping postcodes and generic city/region labels.
 */
function areaFromAddress(address: string | null | undefined): string {
  const raw = address != null ? String(address).trim() : "";
  if (!raw) return "";

  const segments = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const withoutPostcode = segments.filter((s) => !isPostcodeSegment(s));

  const withoutGeneric = withoutPostcode.filter((s) => !GENERIC_LOCATION_SEGMENTS.has(s.toLowerCase()));

  if (withoutGeneric.length > 0) {
    const last = withoutGeneric[withoutGeneric.length - 1] ?? "";
    return stripLeadingHouseNumber(last);
  }

  return firstNonNumericSegment(withoutPostcode);
}

function timeOfDayLabel(t: string | null | undefined): string {
  if (t === "am") return "AM";
  if (t === "pm") return "PM";
  return "All day";
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
  address: string | null;
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

  const details = jobs
    .map((j) => {
      const name = firstName(j.customer_name);
      const area = areaFromAddress(j.address);
      const time = timeOfDayLabel(j.time_of_day);
      const inner = area ? `${area}, ${time}` : time;
      return `${name} (${inner})`;
    })
    .join(" · ");

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
    return new NextResponse("Unauthorised", { status: 401 });
  }

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !restKey) {
    return NextResponse.json({ ok: false, error: "Missing OneSignal configuration" }, { status: 500 });
  }

  const sql = getSql();

  const [todayJobRows, overdueDetailRows] = await Promise.all([
    sql`
      SELECT
        c.name AS customer_name,
        c.address AS address,
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

  const jobs = todayJobRows as JobRow[];
  const followUps = overdueDetailRows as FollowOverdueRow[];

  const message = buildBody(jobs, followUps);
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
    return NextResponse.json(
      { ok: false, sent: false, error: "OneSignal request failed", status: res.status, detail: bodyText.slice(0, 500) },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, sent: true, message, heading });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
