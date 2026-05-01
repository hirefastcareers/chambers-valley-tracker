import { env } from "node:process";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";

function envPresence() {
  return {
    cloud: env.CLOUDINARY_CLOUD_NAME ? "set" : "missing",
    api_key: env.CLOUDINARY_API_KEY ? "set" : "missing",
    api_secret: env.CLOUDINARY_API_SECRET ? "set" : "missing",
    /** Resolved cloud_name for troubleshooting wrong-account issues (temporary debug route). */
    cloud_name: env.CLOUDINARY_CLOUD_NAME?.trim() || null,
  };
}

export async function GET() {
  const presence = envPresence();

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  try {
    const result = await cloudinary.search.expression("tags=gallery").max_results(5).execute();

    return NextResponse.json({
      ok: true,
      total: result.total_count,
      ...presence,
      sample: result.resources.map((r: { public_id: string }) => r.public_id),
    });
  } catch (err: unknown) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ...presence,
    });
  }
}
