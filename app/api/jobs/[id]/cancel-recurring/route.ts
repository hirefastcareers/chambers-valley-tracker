import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const sql = getSql();

  type JobRow = {
    id: number | string;
    recurring_parent_id: number | string | null;
    date_done: string | null;
  };

  const jobRows = await sql`
    SELECT id, recurring_parent_id, date_done
    FROM jobs
    WHERE id = ${idNum}
      AND user_id = ${userId}
    LIMIT 1;
  `;

  const job = (jobRows as JobRow[])[0];
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  let rootId = idNum;
  let cursor = job.recurring_parent_id;
  const seen = new Set<number>([idNum]);
  while (cursor != null) {
    const parentId = Number(cursor);
    if (!Number.isFinite(parentId) || seen.has(parentId)) break;
    seen.add(parentId);
    rootId = parentId;
    const parentRows = await sql`
      SELECT recurring_parent_id
      FROM jobs
      WHERE id = ${parentId}
        AND user_id = ${userId}
      LIMIT 1;
    `;
    cursor = (parentRows as Array<{ recurring_parent_id: number | string | null }>)[0]?.recurring_parent_id ?? null;
  }

  const cutoffDate = job.date_done;
  if (!cutoffDate) {
    await sql`
      UPDATE jobs
      SET is_recurring = false
      WHERE user_id = ${userId}
        AND id = ${idNum};
    `;
    return NextResponse.json({ ok: true });
  }

  await sql`
    WITH RECURSIVE chain AS (
      SELECT id, recurring_parent_id
      FROM jobs
      WHERE id = ${rootId}
        AND user_id = ${userId}
      UNION ALL
      SELECT j.id, j.recurring_parent_id
      FROM jobs j
      INNER JOIN chain c ON j.recurring_parent_id = c.id
      WHERE j.user_id = ${userId}
    )
    UPDATE jobs
    SET is_recurring = false
    WHERE user_id = ${userId}
      AND id IN (
        SELECT chain.id
        FROM chain
        INNER JOIN jobs j ON j.id = chain.id
        WHERE j.date_done IS NOT NULL
          AND j.date_done::date >= ${cutoffDate}::date
      );
  `;

  return NextResponse.json({ ok: true });
}
