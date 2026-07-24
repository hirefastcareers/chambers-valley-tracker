import { env } from "node:process";
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { v2 as cloudinary } from "cloudinary";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

const ADD_TAG_CHUNK = 100;

type PhotoRow = {
  id: number;
  job_id: number;
  type: "before" | "after";
  cloudinary_public_id: string | null;
  cloudinary_url: string | null;
};

/** Strip res.cloudinary.com /…/image/upload/, optional transformations, optional v#, and file extension. */
function extractPublicIdFromCloudinaryUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== "res.cloudinary.com") return null;

    const parts = parsed.pathname.split("/").filter(Boolean);
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx < 0 || uploadIdx + 1 >= parts.length) return null;

    const rest = parts.slice(uploadIdx + 1).map((s) => s.trim()).filter(Boolean);
    if (rest.length === 0) return null;

    while (rest.length > 1 && isCloudinaryTransformationSegment(rest[0] ?? "")) {
      rest.shift();
    }
    if (rest.length === 0) return null;

    const versionIdx = rest.findIndex((p) => /^v\d+$/.test(p));
    const publicSegments =
      versionIdx >= 0 ? rest.slice(versionIdx + 1) : [...rest];

    while (publicSegments.length > 1 && isCloudinaryTransformationSegment(publicSegments[0] ?? "")) {
      publicSegments.shift();
    }

    if (publicSegments.length === 0) return null;

    const last = publicSegments[publicSegments.length - 1] ?? "";
    const dot = last.lastIndexOf(".");
    if (dot > 0) {
      const ext = last.slice(dot + 1).toLowerCase();
      if (isLikelyAssetExtension(ext)) {
        publicSegments[publicSegments.length - 1] = last.slice(0, dot);
      }
    }

    const publicId = publicSegments.join("/").trim();
    return publicId || null;
  } catch {
    return null;
  }
}

function isLikelyAssetExtension(ext: string): boolean {
  return /^(jpe?g|png|gif|webp|avif|svg|bmp|tiff?|heic)$/i.test(ext);
}

function isCloudinaryTransformationSegment(segment: string): boolean {
  return /,/.test(segment) || /^[a-z]{1,3}_/i.test(segment);
}

async function batchAddTag(tag: string, publicIds: string[]): Promise<void> {
  const unique = [...new Set(publicIds.filter((id) => id.length > 0))];
  for (let i = 0; i < unique.length; i += ADD_TAG_CHUNK) {
    const slice = unique.slice(i, i + ADD_TAG_CHUNK);
    if (slice.length > 0) {
      await cloudinary.uploader.add_tag(tag, slice);
    }
  }
}

async function resolvePublicId(sql: ReturnType<typeof neon>, photo: PhotoRow, userId: string): Promise<string | null> {
  let stored = photo.cloudinary_public_id?.trim() ?? null;
  if (stored?.startsWith("http://") || stored?.startsWith("https://")) {
    const fromUrl = extractPublicIdFromCloudinaryUrl(stored);
    stored = fromUrl ?? null;
  }

  let publicId = stored;

  if (!publicId && photo.cloudinary_url) {
    publicId = extractPublicIdFromCloudinaryUrl(photo.cloudinary_url);
    if (publicId) {
      await sql`
        UPDATE photos
        SET cloudinary_public_id = ${publicId}
        WHERE id = ${photo.id}
          AND user_id = ${userId};
      `;
    }
  }

  return publicId ?? null;
}

export async function GET() {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
  const apiKey = env.CLOUDINARY_API_KEY?.trim() ?? "";
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim() ?? "";

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("[migrate-gallery-tags] Missing Cloudinary Admin credentials.", {
      hasCloudName: Boolean(cloudName),
      hasApiKey: Boolean(apiKey),
      hasApiSecret: Boolean(apiSecret),
    });
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
    SELECT p.id, p.job_id, p.type, p.cloudinary_public_id, p.cloudinary_url
    FROM photos p
    INNER JOIN jobs j ON j.id = p.job_id
    WHERE p.user_id = ${userId}
      AND j.user_id = ${userId}
      AND p.type IN ('before'::photo_type, 'after'::photo_type)
      AND (p.cloudinary_public_id IS NOT NULL OR p.cloudinary_url IS NOT NULL);
  `) as PhotoRow[];

  const afterPublicIds: string[] = [];
  const beforePublicIds: string[] = [];
  let skipped = 0;
  let probePublicId: string | null = null;

  for (const photo of rows) {
    const publicId = await resolvePublicId(sql, photo, userId);
    if (!publicId) {
      skipped += 1;
      continue;
    }
    if (!probePublicId) {
      probePublicId = publicId;
    }
    if (photo.type === "after") {
      afterPublicIds.push(publicId);
    } else {
      beforePublicIds.push(publicId);
    }
  }

  let tagged = 0;
  let before_tagged = 0;
  let errors = 0;

  if (probePublicId) {
    try {
      await cloudinary.api.resource(probePublicId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[migrate-gallery-tags] Admin API test call failed.", { probePublicId, message });
      return NextResponse.json(
        {
          ok: false,
          error: "Cloudinary Admin API test call failed.",
          sample_errors: [message],
        },
        { status: 500 }
      );
    }
  }

  try {
    if (afterPublicIds.length > 0) {
      await batchAddTag("gallery", afterPublicIds);
      tagged = afterPublicIds.length;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[migrate-gallery-tags] batch gallery tag failed.", message);
    errors += afterPublicIds.length;
  }

  try {
    if (beforePublicIds.length > 0) {
      await batchAddTag("before", beforePublicIds);
      before_tagged = beforePublicIds.length;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[migrate-gallery-tags] batch before tag failed.", message);
    errors += beforePublicIds.length;
  }

  return NextResponse.json({
    tagged,
    before_tagged,
    skipped,
    errors,
  });
}
