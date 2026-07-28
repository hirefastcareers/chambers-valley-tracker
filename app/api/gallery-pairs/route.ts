import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

type JobRow = {
  job_id: number | string;
  job_type: string;
  date_done: string | Date | null;
};

type PhotoRow = {
  job_id: number | string;
  type: "before" | "after";
  cloudinary_url: string;
  uploaded_at: string | Date | null;
};

export async function GET() {
  try {
    const sql = getSql();

    // Public endpoint: returns photo URLs and job type only (no customer names).
    // First get all jobs that have at least one after photo.
    const jobsResult = (await sql`
      SELECT DISTINCT
        j.id as job_id,
        j.job_type,
        j.date_done
      FROM jobs j
      JOIN photos p ON p.job_id = j.id
      WHERE p.cloudinary_url IS NOT NULL
        AND p.type = 'after'
      ORDER BY j.date_done DESC NULLS LAST
      LIMIT 100
    `) as JobRow[];

    const jobIds = jobsResult.map((r) => Number(r.job_id));

    if (jobIds.length === 0) {
      return NextResponse.json({ pairs: [], total: 0 });
    }

    const photosResult = (await sql`
      SELECT
        p.job_id,
        p.type,
        p.cloudinary_url,
        p.uploaded_at
      FROM photos p
      WHERE p.job_id = ANY(${jobIds})
        AND p.cloudinary_url IS NOT NULL
      ORDER BY p.job_id, p.type, p.uploaded_at ASC
    `) as PhotoRow[];

    // Group photos by job_id
    const photosByJob: Record<number, { before: string[]; after: string[] }> = {};
    for (const photo of photosResult) {
      const jobId = Number(photo.job_id);
      if (!photosByJob[jobId]) {
        photosByJob[jobId] = { before: [], after: [] };
      }
      if (photo.type === "before") {
        photosByJob[jobId].before.push(photo.cloudinary_url);
      } else if (photo.type === "after") {
        photosByJob[jobId].after.push(photo.cloudinary_url);
      }
    }

    // Build the pairs array in date order
    const pairs = jobsResult.map((job) => {
      const jobId = Number(job.job_id);
      return {
        job_id: jobId,
        job_type: job.job_type,
        date_done: job.date_done == null ? null : String(job.date_done),
        before_urls: photosByJob[jobId]?.before || [],
        after_urls: photosByJob[jobId]?.after || [],
      };
    });

    return NextResponse.json({ pairs, total: pairs.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch gallery pairs";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
