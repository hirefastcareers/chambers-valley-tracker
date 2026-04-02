type Sql = ReturnType<typeof import("@/lib/db").getSql>;

type JobRow = { id: number | string; status: string };

/** Coerce API/DB values to YYYY-MM-DD for Postgres ::date casts. */
function calendarDateToIsoYmd(value: string): string {
  const part = value.trim().split("T")[0] ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  return part;
}

/**
 * Keeps the single "Lawn Mow" quoted placeholder job in sync with an open follow-up.
 * Uses follow_ups.job_id when set; otherwise inserts a job and links it.
 */
export async function syncFollowUpPlaceholderJob(
  sql: Sql,
  opts: {
    followUpId: number;
    customerId: number;
    followUpDateIso: string;
    notes: string | null;
    linkedJobId: number | string | null | undefined;
  }
): Promise<{ jobId: number }> {
  const { followUpId, customerId, notes } = opts;
  const ymd = calendarDateToIsoYmd(opts.followUpDateIso);
  const linked = opts.linkedJobId ?? null;

  if (linked != null) {
    const rows = (await sql`
      SELECT id, status::text AS status
      FROM jobs
      WHERE id = ${linked}
      LIMIT 1;
    `) as JobRow[];
    const job = rows[0];
    if (job) {
      if (job.status === "completed") {
        const inserted = (await sql`
          INSERT INTO jobs (customer_id, date_done, status, job_type, description, quote_amount, paid, time_of_day)
          VALUES (
            ${customerId},
            ${ymd}::date,
            'quoted',
            'Lawn Mow',
            ${notes},
            NULL,
            false,
            'all_day'
          )
          RETURNING id;
        `) as { id: number | string }[];
        const newId = Number(inserted[0].id);
        await sql`
          UPDATE follow_ups SET job_id = ${newId} WHERE id = ${followUpId};
        `;
        return { jobId: newId };
      }
      await sql`
        UPDATE jobs
        SET
          date_done = ${ymd}::date,
          description = ${notes},
          job_type = 'Lawn Mow',
          time_of_day = 'all_day'
        WHERE id = ${job.id};
      `;
      return { jobId: Number(job.id) };
    }
  }

  const inserted = (await sql`
    INSERT INTO jobs (customer_id, date_done, status, job_type, description, quote_amount, paid, time_of_day)
    VALUES (
      ${customerId},
      ${ymd}::date,
      'quoted',
      'Lawn Mow',
      ${notes},
      NULL,
      false,
      'all_day'
    )
    RETURNING id;
  `) as { id: number | string }[];
  const newId = Number(inserted[0].id);
  await sql`
    UPDATE follow_ups SET job_id = ${newId} WHERE id = ${followUpId};
  `;
  return { jobId: newId };
}

/**
 * Inserts placeholder jobs for incomplete follow-ups that never received a job (job_id null / stale).
 */
export async function backfillOrphanFollowUpJobs(sql: Sql): Promise<number> {
  const orphans = (await sql`
    SELECT f.id AS follow_up_id, f.customer_id, f.follow_up_date::text AS follow_up_date, f.notes
    FROM follow_ups f
    WHERE f.completed = false
      AND (
        f.job_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM jobs j WHERE j.id = f.job_id)
      );
  `) as {
    follow_up_id: number | string;
    customer_id: number | string;
    follow_up_date: string;
    notes: string | null;
  }[];

  let n = 0;
  for (const row of orphans) {
    const followUpDateIso = calendarDateToIsoYmd(row.follow_up_date);
    if (!followUpDateIso) continue;
    await syncFollowUpPlaceholderJob(sql, {
      followUpId: Number(row.follow_up_id),
      customerId: Number(row.customer_id),
      followUpDateIso,
      notes: row.notes,
      linkedJobId: null,
    });
    n += 1;
  }
  return n;
}
