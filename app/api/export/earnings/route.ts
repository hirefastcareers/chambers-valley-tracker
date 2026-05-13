import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { formatDateDDMMYYYY } from "@/lib/format";
import { ukTaxYearLabelFromISODate } from "@/lib/ukTaxYear";
import {
  chipBudgetMonthYyyyMmFromWeekMonday,
  formatWeekChipShortRange,
  formatWeekOfMonthChipLabel,
  weekMondayYmdForDateDoneYmd,
  weekSundayYmdFromWeekMonday,
} from "@/lib/ukTaxYearWeeks";

export const runtime = "nodejs";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayISODateUtcForFilename() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const sql = getSql();
  type Row = {
    date_done: string | null;
    customer_name: string;
    job_type: string;
    description: string | null;
    quote_amount: string | number | null;
    paid: boolean;
    mileage_miles: string | number | null;
  };

  const rows = (await sql`
    SELECT
      j.date_done::date::text AS date_done,
      c.name AS customer_name,
      j.job_type,
      j.description,
      j.quote_amount,
      j.paid,
      j.mileage_miles
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    WHERE j.paid = true
    ORDER BY j.date_done ASC NULLS LAST, j.created_at ASC;
  `) as Row[];

  const header =
    "Date,Customer,Job Type,Description,Amount (£),Paid,Mileage (miles return),Tax Year,Week Mon (ISO),Week Sun (ISO),Budget month (YYYY-MM),Week chip,Week dates (Mon–Sun)";
  const lines = rows.map((r) => {
    const dateStr = r.date_done ? formatDateDDMMYYYY(r.date_done) : "";
    const amount =
      r.quote_amount === null || r.quote_amount === undefined || r.quote_amount === ""
        ? ""
        : String(Number(r.quote_amount));
    const mileage =
      r.mileage_miles !== null && r.mileage_miles !== undefined && r.mileage_miles !== ""
        ? String(Number(r.mileage_miles))
        : "";
    const taxYear = ukTaxYearLabelFromISODate(r.date_done);
    const desc = r.description ?? "";
    const paid = r.paid ? "Yes" : "No";

    const donePart = r.date_done ? String(r.date_done).split("T")[0] ?? "" : "";
    const weekMon = donePart ? weekMondayYmdForDateDoneYmd(donePart) : null;
    const weekSun = weekMon ? weekSundayYmdFromWeekMonday(weekMon) : "";
    const budgetMonth = weekMon ? chipBudgetMonthYyyyMmFromWeekMonday(weekMon) : "";
    const weekChip = weekMon ? formatWeekOfMonthChipLabel(weekMon) : "";
    const weekDates = weekMon && weekSun ? formatWeekChipShortRange(weekMon, weekSun) : "";

    return [
      csvEscape(dateStr),
      csvEscape(r.customer_name ?? ""),
      csvEscape(r.job_type ?? ""),
      csvEscape(desc),
      csvEscape(amount),
      csvEscape(paid),
      csvEscape(mileage),
      csvEscape(taxYear),
      csvEscape(weekMon ?? ""),
      csvEscape(weekSun),
      csvEscape(budgetMonth),
      csvEscape(weekChip),
      csvEscape(weekDates),
    ].join(",");
  });

  const csv = [header, ...lines].join("\r\n");
  const stamp = todayISODateUtcForFilename();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="patch-earnings-${stamp}.csv"`,
    },
  });
}
