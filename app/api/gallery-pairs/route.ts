import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

type GalleryPairRow = {
  job_id: number | string;
  job_type: string;
  date_done: string | Date | null;
  after_url: string;
  before_url: string | null;
};

export async function GET() {
  try {
    const sql = getSql();

    // Fetch all jobs that have at least one after photo.
    // Group before and after photos by job_id.
    // Public endpoint: returns photo URLs and job type only (no customer names).
    const result = (await sql`
      SELECT
        j.id as job_id,
        j.job_type,
        j.date_done,
        MAX(CASE WHEN p.type = 'after' THEN p.cloudinary_url END) as after_url,
        MAX(CASE WHEN p.type = 'before' THEN p.cloudinary_url END) as before_url
      FROM jobs j
      JOIN photos p ON p.job_id = j.id
      WHERE p.cloudinary_url IS NOT NULL
      GROUP BY j.id, j.job_type, j.date_done
      HAVING MAX(CASE WHEN p.type = 'after' THEN p.cloudinary_url END) IS NOT NULL
      ORDER BY j.date_done DESC NULLS LAST
      LIMIT 100
    `) as GalleryPairRow[];

    const pairs = result.map((row) => ({
      job_id: row.job_id,
      job_type: row.job_type,
      date_done: row.date_done == null ? null : String(row.date_done),
      before_url: row.before_url || null,
      after_url: row.after_url,
    }));

    return NextResponse.json({ pairs, total: pairs.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch gallery pairs";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
