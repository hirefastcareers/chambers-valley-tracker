import { env } from "node:process";
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

    const afterUpload = parts.slice(uploadIdx + 1).map((s) => s.trim()).filter(Boolean);
    if (afterUpload.length === 0) return null;

    const versionIdx = afterUpload.findIndex((p) => /^v\d+$/.test(p));
    let publicPath = versionIdx >= 0 ? afterUpload.slice(versionIdx + 1) : [...afterUpload];
    if (publicPath.length === 0) return null;

    // When no version segment exists, strip leading transformation segments.
    if (versionIdx < 0) {
      while (publicPath.length > 1 && isCloudinaryTransformationSegment(publicPath[0] ?? "")) {
        publicPath.shift();
      }
    }

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

function isCloudinaryTransformationSegment(segment: string): boolean {
  // Typical transformation chunks contain comma-separated directives or directive prefixes like c_, w_, h_, q_.
  return /,/.test(segment) || /^[a-z]{1,3}_/i.test(segment);
}

function buildContextValue(jobId: number, type: "before" | "after") {
  return `job_id=${jobId}|type=${type}`;
}

type CloudinaryUploaderWithContext = typeof cloudinary.uploader & {
  context: (options: { context: string; public_ids: string[] }) => Promise<unknown>;
};

export async function GET() {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  // Use `env` from `node:process` — same bindings as process.env.CLOUDINARY_* but not replaced at
  // compile time (unlike literal process.env.NAME in some Next server bundles).
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
    SELECT id, job_id, type, cloudinary_public_id, cloudinary_url
    FROM photos
    WHERE type IN ('before'::photo_type, 'after'::photo_type)
      AND (cloudinary_public_id IS NOT NULL OR cloudinary_url IS NOT NULL);
  `) as PhotoRow[];

  let tagged = 0;
  let skipped = 0;
  let errors = 0;
  const sampleErrors: string[] = [];

  const firstUsablePhoto = rows.find((row) => {
    if (row.cloudinary_public_id?.trim()) return true;
    if (!row.cloudinary_url) return false;
    return Boolean(extractPublicIdFromCloudinaryUrl(row.cloudinary_url));
  });
  const testPublicId =
    firstUsablePhoto?.cloudinary_public_id?.trim() ||
    (firstUsablePhoto?.cloudinary_url
      ? extractPublicIdFromCloudinaryUrl(firstUsablePhoto.cloudinary_url)
      : null);

  if (testPublicId) {
    try {
      const result = await cloudinary.api.resource(testPublicId);
      console.log("[migrate-gallery-tags] Admin API test call succeeded.", {
        testPublicId,
        resourceType: (result as { resource_type?: string }).resource_type ?? "unknown",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[migrate-gallery-tags] Admin API test call failed.", {
        testPublicId,
        message,
      });
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

  for (const photo of rows) {
    try {
      let publicId = photo.cloudinary_public_id?.trim() || null;

      if (!publicId && photo.cloudinary_url) {
        console.log("[migrate-gallery-tags] Attempting public ID extraction.", {
          photoId: photo.id,
          url: photo.cloudinary_url,
        });
        publicId = extractPublicIdFromCloudinaryUrl(photo.cloudinary_url);
        console.log("[migrate-gallery-tags] Public ID extraction result.", {
          photoId: photo.id,
          extractedPublicId: publicId,
        });
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
        await (cloudinary.uploader as CloudinaryUploaderWithContext).context({
          context: buildContextValue(photo.job_id, photo.type),
          public_ids: [publicId],
        });
      }

      tagged += 1;
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      const errLog = `photo_id=${photo.id} job_id=${photo.job_id} type=${photo.type} error=${message}`;
      console.error("[migrate-gallery-tags] Failed to process photo.", errLog);
      if (sampleErrors.length < 5) {
        sampleErrors.push(errLog);
      }
    }
  }

  return NextResponse.json({ tagged, skipped, errors, sample_errors: sampleErrors });
}
