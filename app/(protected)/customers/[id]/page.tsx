import { Suspense } from "react";
import { getSql } from "@/lib/db";
import CustomerDetail from "@/components/CustomerDetail";
import type { JobStatus } from "@/lib/status";

export default async function CustomerDetailPage({
  params,
}: {
  // Next.js can pass route params differently depending on runtime/hydration paths.
  // Accept both a plain object and a Promise to avoid `id` being undefined.
  params: { id: string } | Promise<{ id: string }>;
}) {
  const sql = getSql();
  const resolved = await params;
  // Neon can return ids as strings; parse more defensively than `Number(...)`.
  const rawId = String(resolved?.id ?? "");
  // If the route param ever contains unexpected characters, extract the first number.
  const idMatch = rawId.match(/\d+/);
  const customerId = idMatch ? Number(idMatch[0]) : NaN;
  if (!Number.isFinite(customerId)) {
    return <div className="text-sm text-zinc-600">Invalid customer.</div>;
  }

  const customerRows = await sql`
    SELECT id, name, address, phone, email, notes, tags
    FROM customers
    WHERE id = ${customerId}
    LIMIT 1;
  `;

  type CustomerRow = {
    id: number | string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    tags: string[] | null;
  };

  const customerRowsTyped = customerRows as CustomerRow[];
  const customer = customerRowsTyped[0];
  if (!customer) {
    return <div className="text-sm text-zinc-600">Customer not found.</div>;
  }

  type JobStatusValue = JobStatus;
  type JobRow = {
    id: number | string;
    customer_id: number | string;
    job_type: string;
    description: string | null;
    status: JobStatusValue;
    quote_amount: string | number | null;
    paid: boolean;
    date_done: string | null;
    time_of_day: "am" | "pm" | "all_day" | null;
  };
  type FollowUpRow = {
    id: number | string;
    follow_up_date: string;
    notes: string | null;
    completed: boolean;
  };
  type RecurringReminderRow = {
    id: number | string;
    job_type: string;
    interval_days: number | string;
    last_done_date: string | null;
    next_due_date: string;
    active: boolean;
  };
  type PhotoQueryRow = {
    id: number | string;
    job_id: number | string;
    cloudinary_url: string;
    type: "before" | "after";
  };
  type Photo = {
    id: number;
    cloudinary_url: string;
    type: "before" | "after";
  };

  const [latestJobRows, nextFollowUpDateRows, followUps, recurringReminders, jobHistoryRows] = await Promise.all([
    sql`
      SELECT id, customer_id, job_type, description, status, quote_amount, paid, date_done, time_of_day
      FROM jobs
      WHERE customer_id = ${customerId}
      ORDER BY date_done DESC NULLS LAST, created_at DESC
      LIMIT 1;
    `,
    sql`
      SELECT MIN(fu.follow_up_date) AS next_follow_up_date
      FROM follow_ups fu
      WHERE fu.customer_id = ${customerId}
        AND fu.completed = false;
    `,
    sql`
      SELECT id, follow_up_date, notes, completed
      FROM follow_ups
      WHERE customer_id = ${customerId}
      ORDER BY follow_up_date DESC;
    `,
    sql`
      SELECT id, job_type, interval_days, last_done_date, next_due_date, active
      FROM recurring_reminders
      WHERE customer_id = ${customerId}
      ORDER BY next_due_date ASC;
    `,
    sql`
      SELECT id, customer_id, job_type, description, status, quote_amount, paid, date_done, time_of_day
      FROM jobs
      WHERE customer_id = ${customerId}
      ORDER BY created_at DESC;
    `,
  ]);

  const latestJobRowsTyped = latestJobRows as JobRow[];
  const latestJobRow = latestJobRowsTyped[0] ?? undefined;

  type NextFollowUpDateRow = { next_follow_up_date: string | null };
  const nextFollowUpDateRowTyped = nextFollowUpDateRows as NextFollowUpDateRow[];
  const nextFollowUpDate = nextFollowUpDateRowTyped[0]?.next_follow_up_date ?? null;

  const jobHistoryRowsTyped = jobHistoryRows as JobRow[];
  const jobIds = jobHistoryRowsTyped.map((j) => Number(j.id));
  let photos: PhotoQueryRow[] = [];
  if (jobIds.length > 0) {
    photos = (await sql`
      SELECT id, job_id, cloudinary_url, type
      FROM photos
      WHERE job_id = ANY(${jobIds});
    `) as PhotoQueryRow[];
  }

  const photosByJobId = new Map<number, Photo[]>();
  for (const p of photos) {
    const key = Number(p.job_id);
    const list = photosByJobId.get(key) ?? [];
    list.push({
      id: Number(p.id),
      cloudinary_url: p.cloudinary_url,
      type: p.type,
    });
    photosByJobId.set(key, list);
  }

  const jobHistory = jobHistoryRowsTyped.map((j) => ({
    id: Number(j.id),
    job_type: j.job_type,
    description: j.description,
    status: j.status,
    quote_amount: j.quote_amount,
    paid: Boolean(j.paid),
    date_done: j.date_done,
    time_of_day: j.time_of_day ?? "all_day",
    photos: photosByJobId.get(Number(j.id)) ?? [],
  }));

  const latestJobWithPhotos = latestJobRow
    ? {
        id: Number(latestJobRow.id),
        job_type: latestJobRow.job_type,
        description: latestJobRow.description,
        status: latestJobRow.status,
        quote_amount: latestJobRow.quote_amount,
        paid: Boolean(latestJobRow.paid),
        date_done: latestJobRow.date_done,
        time_of_day: latestJobRow.time_of_day ?? "all_day",
        photos: photosByJobId.get(Number(latestJobRow.id)) ?? [],
      }
    : null;

  const followUpsTyped = followUps as FollowUpRow[];
  const recurringTyped = recurringReminders as RecurringReminderRow[];

  return (
    <Suspense fallback={<div className="p-4 text-sm text-[var(--color-text-muted)]">Loading…</div>}>
      <CustomerDetail
        customer={{
          id: Number(customer.id),
          name: customer.name,
          address: customer.address,
          phone: customer.phone,
          email: customer.email,
          notes: customer.notes,
          tags: customer.tags ?? [],
        }}
        latestJob={latestJobWithPhotos}
        nextFollowUpDate={nextFollowUpDate}
        followUps={followUpsTyped.map((f) => ({
          id: Number(f.id),
          follow_up_date: f.follow_up_date,
          notes: f.notes,
          completed: Boolean(f.completed),
        }))}
        recurringReminders={recurringTyped.map((r) => ({
          id: Number(r.id),
          job_type: r.job_type,
          interval_days: Number(r.interval_days),
          last_done_date: r.last_done_date,
          next_due_date: r.next_due_date,
          active: Boolean(r.active),
        }))}
        jobHistory={jobHistory}
      />
    </Suspense>
  );
}

