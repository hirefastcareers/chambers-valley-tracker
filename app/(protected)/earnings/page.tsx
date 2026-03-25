import Card from "@/components/Card";
import MonthlyEarningsChart from "@/components/MonthlyEarningsChart";
import OutstandingJobs from "@/components/OutstandingJobs";
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

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#2d6a4f]">Earnings</h1>
        <div className="text-sm text-zinc-600 mt-1">Based on completed jobs where payment is marked as paid.</div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Card>
          <div className="p-4">
            <div className="text-xs font-semibold text-zinc-500">This month</div>
            <div className="text-3xl font-semibold text-[#2d6a4f] mt-2">{formatMoneyGBP(thisMonthTotal)}</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-xs font-semibold text-zinc-500">Last month</div>
            <div className="text-3xl font-semibold text-[#2d6a4f] mt-2">{formatMoneyGBP(lastMonthTotal)}</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-xs font-semibold text-zinc-500">Year-to-date (Apr 6 - Apr 5)</div>
            <div className="text-3xl font-semibold text-[#2d6a4f] mt-2">{formatMoneyGBP(ytdTotal)}</div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4">
          <div className="text-[#2d6a4f] font-semibold">Tax estimate (rough)</div>
          <div className="text-sm text-zinc-600 mt-1">Estimate only. Not financial advice.</div>
          <div className="mt-4">
            <div className="text-sm text-zinc-700">
              20% of earnings above <span className="font-semibold">£12,570</span>
            </div>
            <div className="text-2xl font-semibold text-[#2d6a4f] mt-2">Set aside {formatMoneyGBP(taxEstimate)}</div>
          </div>
        </div>
      </Card>

      <OutstandingJobs rows={outstandingRowsTyped} total={outstandingTotal} />

      <Card>
        <div className="p-4">
          <div className="text-[#2d6a4f] font-semibold">Per-customer breakdown</div>
          <div className="text-xs text-zinc-600 mt-1">All-time (paid + completed)</div>

          <div className="mt-3 flex flex-col gap-2">
            {perCustomer.length === 0 ? (
              <div className="text-sm text-zinc-600">No data yet.</div>
            ) : (
              perCustomer.map((c) => (
                <details key={c.customerId} className="rounded-2xl border border-zinc-200 p-3 bg-white">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900 truncate">{c.customerName}</div>
                      <div className="text-xs text-zinc-600">{c.completedJobs} jobs completed</div>
                    </div>
                    <div className="text-sm font-semibold text-zinc-900">{formatMoneyGBP(c.totalEarnings)}</div>
                  </summary>
                  <div className="mt-3 text-sm text-zinc-700">
                    Average job value: <span className="font-semibold">{formatMoneyGBP(c.avgJobValue)}</span>
                  </div>
                </details>
              ))
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <div className="text-[#2d6a4f] font-semibold">Monthly earnings</div>
          <div className="text-xs text-zinc-600 mt-1">Current calendar year</div>
          <div className="mt-3">
            <MonthlyEarningsChart data={chartData} />
          </div>
        </div>
      </Card>

      <div className="text-center text-sm text-zinc-600">
        All-time total: <span className="font-semibold text-[#2d6a4f] text-lg">{formatMoneyGBP(allTimeTotal)}</span>
      </div>
    </div>
  );
}

