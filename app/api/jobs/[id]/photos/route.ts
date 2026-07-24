import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { parseAndValidatePhotoPayload } from "@/lib/photoPayload";

export const runtime = "nodejs";

function getNumericJobId(raw: string) {
  const idNum = Number(raw);
  return Number.isFinite(idNum) ? idNum : NaN;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const { id } = await params;
  const jobId = getNumericJobId(id);
  if (!Number.isFinite(jobId)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const wantUrls = new URL(req.url).searchParams.get("urls") === "1";
  const sql = getSql();

  const jobRows = await sql`
    SELECT id
    FROM jobs
    WHERE id = ${jobId}
      AND user_id = ${userId}
    LIMIT 1;
  `;
  if (!(jobRows as unknown[]).length) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  if (!wantUrls) {
    const rows = await sql`
      SELECT COUNT(*)::int AS count
      FROM photos
      WHERE job_id = ${jobId}
        AND user_id = ${userId};
    `;
    const count = Number((rows as Array<{ count: number | string }>)[0]?.count ?? 0);
    return NextResponse.json({ ok: true, hasPhotos: count > 0 });
  }

  const rows = await sql`
    SELECT cloudinary_url, type::text AS type
    FROM photos
    WHERE job_id = ${jobId}
      AND user_id = ${userId}
    ORDER BY uploaded_at ASC, id ASC;
  `;

  const afterUrls: string[] = [];
  const beforeUrls: string[] = [];
  for (const r of rows as Array<{ cloudinary_url: string; type: string }>) {
    if (r.type === "after") afterUrls.push(r.cloudinary_url);
    else beforeUrls.push(r.cloudinary_url);
  }

  return NextResponse.json({
    ok: true,
    hasPhotos: afterUrls.length + beforeUrls.length > 0,
    afterUrls,
    beforeUrls,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const { id } = await params;
  const jobId = getNumericJobId(id);
  if (!Number.isFinite(jobId)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const json = (await req.json().catch(() => null)) as { photos?: unknown } | null;
  const photos = json?.photos;
  if (!Array.isArray(photos) || photos.length === 0) {
    return NextResponse.json({ ok: false, error: "No photos provided" }, { status: 400 });
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName) {
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration: missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME" },
      { status: 500 }
    );
  }

  const parsed = parseAndValidatePhotoPayload(JSON.stringify(photos), cloudName);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const sql = getSql();
  const jobRows = await sql`
    SELECT id
    FROM jobs
    WHERE id = ${jobId}
      AND user_id = ${userId}
    LIMIT 1;
  `;
  if (!(jobRows as unknown[]).length) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  for (const p of parsed.items) {
    await sql`
      INSERT INTO photos (user_id, job_id, cloudinary_url, type, tags, cloudinary_public_id)
      VALUES (${userId}, ${jobId}, ${p.url}, ${p.type}::photo_type, ${p.tags}::text[], ${p.cloudinaryPublicId});
    `;
  }

  return NextResponse.json({ ok: true });
}
