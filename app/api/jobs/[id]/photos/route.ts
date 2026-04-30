import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { parseAndValidatePhotoPayload } from "@/lib/photoPayload";

export const runtime = "nodejs";

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function getNumericJobId(raw: string) {
  const idNum = Number(raw);
  return Number.isFinite(idNum) ? idNum : NaN;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const { id } = await params;
  const jobId = getNumericJobId(id);
  if (!Number.isFinite(jobId)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM photos
    WHERE job_id = ${jobId};
  `;

  const count = Number((rows as Array<{ count: number | string }>)[0]?.count ?? 0);
  return NextResponse.json({ ok: true, hasPhotos: count > 0 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

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
  for (const p of parsed.items) {
    await sql`
      INSERT INTO photos (job_id, cloudinary_url, type)
      VALUES (${jobId}, ${p.url}, ${p.type}::photo_type);
    `;
  }

  return NextResponse.json({ ok: true });
}

