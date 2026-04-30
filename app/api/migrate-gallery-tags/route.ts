import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { v2 as cloudinary } from "cloudinary";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

type PhotoRow = {
  id: number;
  job_id: number;
  type: "before" | "after";
  cloudinary_public_id: string | null;
  cloudinary_url: string | null;
};

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function extractPublicIdFromCloudinaryUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "res.cloudinary.com") return null;

    const parts = parsed.pathname.split("/").filter(Boolean);
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx < 0 || uploadIdx + 1 >= parts.length) return null;

    const afterUpload = parts.slice(uploadIdx + 1);
    const versionIdx = afterUpload.findIndex((p) => /^v\d+$/.test(p));
    const fromIdx = versionIdx >= 0 ? versionIdx + 1 : 0;
    const publicPath = afterUpload.slice(fromIdx);
    if (publicPath.length === 0) return null;

    const last = publicPath[publicPath.length - 1] ?? "";
    const dot = last.lastIndexOf(".");
    if (dot > 0) {
      publicPath[publicPath.length - 1] = last.slice(0, dot);
    }

    const publicId = publicPath.join("/").trim();
    return publicId || null;
  } catch {
    return null;
  }
}

function buildContextValue(jobId: number, type: "before" | "after") {
  return `job_id=${jobId}|type=${type}`;
}

export async function GET() {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { ok: false, error: "Missing Cloudinary Admin credentials on the server." },
      { status: 500 }
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  const sql = getSql();
  const rows = (await sql`
    SELECT id, job_id, type, cloudinary_public_id, cloudinary_url
    FROM photos
    WHERE type IN ('before'::photo_type, 'after'::photo_type)
      AND (cloudinary_public_id IS NOT NULL OR cloudinary_url IS NOT NULL);
  `) as PhotoRow[];

  let tagged = 0;
  let skipped = 0;
  let errors = 0;

  for (const photo of rows) {
    try {
      let publicId = photo.cloudinary_public_id?.trim() || null;

      if (!publicId && photo.cloudinary_url) {
        publicId = extractPublicIdFromCloudinaryUrl(photo.cloudinary_url);
        if (publicId) {
          await sql`
            UPDATE photos
            SET cloudinary_public_id = ${publicId}
            WHERE id = ${photo.id};
          `;
        }
      }

      if (!publicId) {
        skipped += 1;
        continue;
      }

      const tags =
        photo.type === "after" ? ["after", "patch", "gallery"] : ["before", "patch"];

      for (const tag of tags) {
        await cloudinary.uploader.add_tag(tag, [publicId]);
      }

      const resource = (await cloudinary.api.resource(publicId, {
        context: true,
      })) as { context?: { custom?: Record<string, string> } };

      const customContext = resource.context?.custom ?? {};
      const needsContext =
        customContext.job_id !== String(photo.job_id) || customContext.type !== photo.type;

      if (needsContext) {
        await cloudinary.uploader.context({
          context: buildContextValue(photo.job_id, photo.type),
          public_ids: [publicId],
        });
      }

      tagged += 1;
    } catch {
      errors += 1;
    }
  }

  return NextResponse.json({ tagged, skipped, errors });
}
