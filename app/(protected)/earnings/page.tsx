import Card from "@/components/Card";
import MonthlyEarningsChart from "@/components/MonthlyEarningsChart";
import OutstandingJobs from "@/components/OutstandingJobs";
import PageHeader from "@/components/PageHeader";
import { formatMoneyGBP } from "@/lib/format";
import { getSql } from "@/lib/db";

function toISODateLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getTaxYearRange(now: Date) {
  // UK-style (as requested): April 6 to April 5.
  const year = now.getFullYear();
  const april6ThisYear = new Date(year, 3, 6); // month is 0-indexed
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
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); // exclusive
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1); // exclusive

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
  ] = await Promise.all([
    sql`
      SELECT COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE status = 'completed'
        AND paid = true
        AND date_done >= ${monthStartStr}::date
        AND date_done < ${monthEndStr}::date;
    `,
    sql`
      SELECT COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE status = 'completed'
        AND paid = true
        AND date_done >= ${lastMonthStartStr}::date
        AND date_done < ${lastMonthEndStr}::date;
    `,
    sql`
      SELECT COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE status = 'completed'
        AND paid = true
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
       AND j.status = 'completed'
       AND j.paid = true
      GROUP BY c.id, c.name
      ORDER BY total_earnings DESC;
    `,
    sql`
      SELECT
        EXTRACT(MONTH FROM date_done)::int AS month_num,
        COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE status = 'completed'
        AND paid = true
        AND date_done >= ${toISODateLocal(new Date(now.getFullYear(), 0, 1))}::date
        AND date_done <= ${toISODateLocal(new Date(now.getFullYear(), 11, 31))}::date
      GROUP BY month_num
      ORDER BY month_num;
    `,
    sql`
      SELECT COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE status = 'completed'
        AND paid = true;
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

  const currentMonthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(now);

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader>
        <div>
          <h1 className="font-display text-[28px] text-white leading-tight font-normal">Earnings</h1>
          <p className="text-[12px] text-[#52b788] mt-2">{currentMonthLabel}</p>
          <p className="text-[13px] text-white/80 mt-3 max-w-[90%]">
            Based on completed jobs where payment is marked as paid.
          </p>
        </div>
      </PageHeader>

      <Card>
        <div className="p-[18px]">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="min-w-0 text-center sm:text-left">
              <div className="section-label-card">This month</div>
              <div className="font-display text-xl sm:text-2xl font-normal text-[var(--color-primary)] mt-2 tabular-nums leading-tight break-words">
                {formatMoneyGBP(thisMonthTotal)}
              </div>
            </div>
            <div className="min-w-0 text-center sm:text-left border-x border-[var(--color-border)] px-2 sm:px-3">
              <div className="section-label-card">Last month</div>
              <div className="font-display text-xl sm:text-2xl font-normal text-[var(--color-primary)] mt-2 tabular-nums leading-tight break-words">
                {formatMoneyGBP(lastMonthTotal)}
              </div>
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <div className="section-label-card">Ytd</div>
              <div className="font-display text-xl sm:text-2xl font-normal text-[var(--color-primary)] mt-2 tabular-nums leading-tight break-words">
                {formatMoneyGBP(ytdTotal)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-[18px]">
          <div className="font-display text-[18px] text-[#1a4731] font-normal">Tax estimate (rough)</div>
          <div className="text-sm text-[var(--color-text-muted)] mt-1">Estimate only. Not financial advice.</div>
          <div className="mt-4">
            <div className="text-sm text-[var(--color-text)]">
              20% of earnings above <span className="font-semibold">£12,570</span>
            </div>
            <div className="font-display text-2xl font-normal text-[var(--color-primary)] mt-2">Set aside {formatMoneyGBP(taxEstimate)}</div>
          </div>
        </div>
      </Card>

      <OutstandingJobs rows={outstandingRowsTyped} total={outstandingTotal} />

      <Card>
        <div className="p-[18px]">
          <div className="font-display text-[18px] text-[#1a4731] font-normal">Per-customer breakdown</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">All-time (paid + completed)</div>

          <div className="mt-3 flex flex-col gap-2">
            {perCustomer.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[#f6faf6]/80 px-4 py-10 text-center">
                <div className="text-4xl mb-3" aria-hidden>
                  📋
                </div>
                <p className="font-display text-[18px] text-[#1a4731]">No earnings data yet</p>
                <p className="text-sm text-[var(--color-text-muted)] mt-2">Complete paid jobs to see breakdowns here.</p>
              </div>
            ) : (
              perCustomer.map((c) => (
                <details key={c.customerId} className="rounded-2xl border border-[var(--color-border)] p-3 bg-[var(--color-white)] clickable-card">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-text)] truncate font-display">{c.customerName}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{c.completedJobs} jobs completed</div>
                    </div>
                    <div className="text-[17px] font-normal font-display text-[#2d6a4f]">{formatMoneyGBP(c.totalEarnings)}</div>
                  </summary>
                  <div className="mt-3 text-sm text-[var(--color-text)]">
                    Average job value:{" "}
                    <span className="font-display text-[#2d6a4f]">{formatMoneyGBP(c.avgJobValue)}</span>
                  </div>
                </details>
              ))
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-[18px]">
          <div className="font-display text-[18px] text-[#1a4731] font-normal">Monthly earnings</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">Current calendar year</div>
          <div className="mt-3">
            <MonthlyEarningsChart data={chartData} />
          </div>
        </div>
      </Card>

      <div className="text-center text-sm text-[var(--color-text-muted)]">
        All-time total:{" "}
        <span className="font-display font-normal text-[var(--color-primary)] text-lg">{formatMoneyGBP(allTimeTotal)}</span>
      </div>
    </div>
  );
}

