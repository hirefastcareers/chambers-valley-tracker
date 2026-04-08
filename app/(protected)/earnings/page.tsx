import Card from "@/components/Card";
import MonthlyEarningsChart from "@/components/MonthlyEarningsChart";
import OutstandingJobs from "@/components/OutstandingJobs";
import PageHeader from "@/components/PageHeader";
import { ClipboardList } from "lucide-react";
import { formatMoneyGBP } from "@/lib/format";
import { getSql } from "@/lib/db";

function toISODateLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getTaxYearRange(now: Date) {
  const year = now.getFullYear();
  const april6ThisYear = new Date(year, 3, 6);
  if (now >= april6ThisYear) {
    const start = april6ThisYear;
    const end = new Date(year + 1, 3, 5);
    return { start, end };
  }
  const start = new Date(year - 1, 3, 6);
  const end = new Date(year, 3, 5);
  return { start, end };
}

export default async function EarningsPage() {
  const sql = getSql();
  const now = new Date();

  type OutstandingRowQuery = {
    job_id: number | string;
    customer_name: string;
    job_type: string;
    date_done: string | null;
    quote_amount: string | number | null;
  };
  type PerCustomerRowQuery = {
    customer_id: number | string;
    customer_name: string;
    completed_jobs: number | string;
    total_earnings: string | number | null;
    avg_job_value: string | number | null;
  };
  type MonthSumRowQuery = {
    month_num: number | string;
    total: string | number | null;
  };

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  const { start: taxStart, end: taxEnd } = getTaxYearRange(now);

  const monthStartStr = toISODateLocal(monthStart);
  const monthEndStr = toISODateLocal(monthEnd);
  const lastMonthStartStr = toISODateLocal(lastMonthStart);
  const lastMonthEndStr = toISODateLocal(lastMonthEnd);
  const taxStartStr = toISODateLocal(taxStart);
  const taxEndStr = toISODateLocal(taxEnd);

  const [
    thisMonthTotalRows,
    lastMonthTotalRows,
    ytdTotalRows,
    outstandingRows,
    perCustomerRows,
    monthSumsRows,
    allTimeTotalRows,
    taxYearMileageRows,
  ] = await Promise.all([
    sql`
      SELECT COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE paid = true
        AND date_done >= ${monthStartStr}::date
        AND date_done < ${monthEndStr}::date;
    `,
    sql`
      SELECT COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE paid = true
        AND date_done >= ${lastMonthStartStr}::date
        AND date_done < ${lastMonthEndStr}::date;
    `,
    sql`
      SELECT COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE paid = true
        AND date_done >= ${taxStartStr}::date
        AND date_done <= ${taxEndStr}::date;
    `,
    sql`
      SELECT
        j.id AS job_id,
        c.name AS customer_name,
        j.job_type,
        j.date_done,
        j.quote_amount
      FROM jobs j
      JOIN customers c ON c.id = j.customer_id
      WHERE j.status = 'completed'
        AND j.paid = false
      ORDER BY j.date_done DESC NULLS LAST, j.created_at DESC;
    `,
    sql`
      SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        COUNT(j.id) AS completed_jobs,
        COALESCE(SUM(j.quote_amount), 0) AS total_earnings,
        COALESCE(AVG(j.quote_amount), 0) AS avg_job_value
      FROM customers c
      LEFT JOIN jobs j
        ON j.customer_id = c.id
       AND j.paid = true
      GROUP BY c.id, c.name
      ORDER BY total_earnings DESC;
    `,
    sql`
      SELECT
        EXTRACT(MONTH FROM date_done)::int AS month_num,
        COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE paid = true
        AND date_done >= ${toISODateLocal(new Date(now.getFullYear(), 0, 1))}::date
        AND date_done <= ${toISODateLocal(new Date(now.getFullYear(), 11, 31))}::date
      GROUP BY month_num
      ORDER BY month_num;
    `,
    sql`
      SELECT COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE paid = true;
    `,
    sql`
      SELECT COALESCE(SUM(mileage_miles), 0) AS total_miles
      FROM jobs
      WHERE status = 'completed'
        AND date_done >= ${taxStartStr}::date
        AND date_done <= ${taxEndStr}::date;
    `,
  ]);

  type TotalRow = { total: string | number };
  const thisMonthTotalRowsTyped = thisMonthTotalRows as TotalRow[];
  const lastMonthTotalRowsTyped = lastMonthTotalRows as TotalRow[];
  const ytdTotalRowsTyped = ytdTotalRows as TotalRow[];
  const allTimeTotalRowsTyped = allTimeTotalRows as TotalRow[];

  const thisMonthTotal = Number(thisMonthTotalRowsTyped[0]?.total ?? 0);
  const lastMonthTotal = Number(lastMonthTotalRowsTyped[0]?.total ?? 0);
  const ytdTotal = Number(ytdTotalRowsTyped[0]?.total ?? 0);

  const personalAllowance = 12570;
  const taxableAboveAllowance = Math.max(0, ytdTotal - personalAllowance);
  const taxEstimate = taxableAboveAllowance * 0.2;

  const outstandingRowsTypedQuery = outstandingRows as OutstandingRowQuery[];
  const outstandingRowsTyped = outstandingRowsTypedQuery.map((r) => ({
    jobId: Number(r.job_id),
    customerName: r.customer_name,
    jobType: r.job_type,
    date_done: r.date_done ? String(r.date_done) : null,
    quote_amount: r.quote_amount,
  }));
  const outstandingTotal = outstandingRowsTypedQuery.reduce(
    (sum: number, r) => sum + Number(r.quote_amount ?? 0),
    0
  );

  const monthTotalsByNum = new Map<number, number>();
  for (const r of monthSumsRows as MonthSumRowQuery[]) {
    monthTotalsByNum.set(Number(r.month_num), Number(r.total ?? 0));
  }

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const chartData = monthLabels.map((label, idx) => {
    const monthNum = idx + 1;
    return { monthLabel: label, value: monthTotalsByNum.get(monthNum) ?? 0 };
  });

  const perCustomerRowsTyped = perCustomerRows as PerCustomerRowQuery[];
  const perCustomer = perCustomerRowsTyped.map((r) => ({
    customerId: Number(r.customer_id),
    customerName: r.customer_name,
    completedJobs: Number(r.completed_jobs),
    totalEarnings: Number(r.total_earnings ?? 0),
    avgJobValue: Number(r.avg_job_value ?? 0),
  }));

  const allTimeTotal = Number(allTimeTotalRowsTyped[0]?.total ?? 0);
  const totalMilesTaxYear = Number((taxYearMileageRows as Array<{ total_miles: string | number }>)[0]?.total_miles ?? 0);
  const mileageTaxRelief = totalMilesTaxYear * 0.45;

  const currentMonthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(now);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader>
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--c-text)] leading-tight">Earnings</h1>
          <p className="text-[14px] text-[var(--c-text-muted)] mt-1">{currentMonthLabel}</p>
          <p className="text-[14px] text-[var(--c-text-muted)] mt-2 max-w-[90%] leading-snug">
            Based on completed jobs where payment is marked as paid.
          </p>
        </div>
      </PageHeader>

      <Card>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="min-w-0 text-center sm:text-left">
              <div className="section-label-card">This month</div>
              <div className="font-currency text-xl sm:text-2xl text-[var(--c-text)] mt-2 tabular-nums leading-tight break-words">
                {formatMoneyGBP(thisMonthTotal)}
              </div>
            </div>
            <div className="min-w-0 text-center sm:text-left border-x border-[var(--c-border)] px-2 sm:px-3">
              <div className="section-label-card">Last month</div>
              <div className="font-currency text-xl sm:text-2xl text-[var(--c-text)] mt-2 tabular-nums leading-tight break-words">
                {formatMoneyGBP(lastMonthTotal)}
              </div>
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <div className="section-label-card">Ytd</div>
              <div className="font-currency text-xl sm:text-2xl text-[var(--c-text)] mt-2 tabular-nums leading-tight break-words">
                {formatMoneyGBP(ytdTotal)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <div className="text-[15px] font-semibold text-[var(--c-text)]">Tax estimate</div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-6">
            <div className="min-w-0 text-center sm:text-left">
              <div className="section-label-card">Set aside</div>
              <div className="font-currency text-xl sm:text-2xl text-[var(--c-text)] mt-2 tabular-nums leading-tight">
                {formatMoneyGBP(taxEstimate)}
              </div>
            </div>
            <div className="min-w-0 text-center sm:text-left border-l border-[var(--c-border)] pl-4 sm:pl-6">
              <div className="section-label-card">Ytd earnings</div>
              <div className="font-currency text-xl sm:text-2xl text-[var(--c-text)] mt-2 tabular-nums leading-tight">
                {formatMoneyGBP(ytdTotal)}
              </div>
            </div>
          </div>
          <p className="mt-4 pt-3 border-t border-[var(--c-border)] text-[11px] text-[var(--c-text-muted)] leading-snug">
            Based on 20% above the £12,570 personal allowance
          </p>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <div className="text-[15px] font-semibold text-[var(--c-text)]">Mileage &amp; tax relief</div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-6">
            <div className="min-w-0 text-center sm:text-left">
              <div className="section-label-card">Tax year miles</div>
              <div className="text-xl sm:text-2xl text-[var(--c-text)] mt-2 tabular-nums leading-tight">
                {totalMilesTaxYear.toFixed(1)}
              </div>
            </div>
            <div className="min-w-0 text-center sm:text-left border-l border-[var(--c-border)] pl-4 sm:pl-6">
              <div className="section-label-card">HMRC relief (45p)</div>
              <div className="font-currency text-xl sm:text-2xl text-[var(--c-text)] mt-2 tabular-nums leading-tight">
                {formatMoneyGBP(mileageTaxRelief)}
              </div>
            </div>
          </div>
          <p className="mt-4 text-[13px] text-[var(--c-text-muted)]">
            {totalMilesTaxYear.toFixed(1)} miles x 45p = {formatMoneyGBP(mileageTaxRelief)} tax relief
          </p>
          <p className="mt-3 pt-3 border-t border-[var(--c-border)] text-[11px] text-[var(--c-text-muted)] leading-snug">
            Based on HMRC approved mileage rate for the first 10,000 miles
          </p>
        </div>
      </Card>

      <OutstandingJobs rows={outstandingRowsTyped} total={outstandingTotal} />

      <Card>
        <div className="p-4">
          <div className="text-[15px] font-semibold text-[var(--c-text)]">Per-customer breakdown</div>
          <div className="text-xs text-[var(--c-text-muted)] mt-1">All-time (paid + completed)</div>

          <div className="mt-3 flex flex-col gap-2">
            {perCustomer.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[var(--c-border-strong)] bg-[var(--c-surface)] px-4 py-10 text-center">
                <div className="flex justify-center mb-3 text-[var(--c-text-muted)]" aria-hidden>
                  <ClipboardList className="w-10 h-10 stroke-[1.5]" />
                </div>
                <p className="text-[15px] font-semibold text-[var(--c-text)]">No earnings data yet</p>
                <p className="text-sm text-[var(--c-text-muted)] mt-2">Complete paid jobs to see breakdowns here.</p>
              </div>
            ) : (
              perCustomer.map((c) => (
                <details
                  key={c.customerId}
                  className="rounded-[14px] border border-[var(--c-border)] p-3 bg-[var(--c-surface)] clickable-card "
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--c-text)] truncate">{c.customerName}</div>
                      <div className="text-xs text-[var(--c-text-muted)]">{c.completedJobs} jobs completed</div>
                    </div>
                    <div className="font-currency text-[17px] text-[var(--c-text)]">{formatMoneyGBP(c.totalEarnings)}</div>
                  </summary>
                  <div className="mt-3 text-sm text-[var(--c-text)]">
                    Average job value: <span className="font-currency text-[var(--c-text)]">{formatMoneyGBP(c.avgJobValue)}</span>
                  </div>
                </details>
              ))
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <div className="text-[15px] font-semibold text-[var(--c-text)]">Monthly earnings</div>
          <div className="text-xs text-[var(--c-text-muted)] mt-1">Current calendar year</div>
          <div className="mt-3">
            <MonthlyEarningsChart data={chartData} />
          </div>
        </div>
      </Card>

      <div className="text-center text-sm text-[var(--c-text-muted)]">
        All-time total: <span className="font-currency text-[var(--c-text)] text-lg">{formatMoneyGBP(allTimeTotal)}</span>
      </div>
    </div>
  );
}
