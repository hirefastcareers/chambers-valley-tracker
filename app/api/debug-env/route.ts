import { NextResponse } from "next/server";

/** Temporary: verify Cloudinary-related env bindings on Vercel (presence only). */
export const runtime = "nodejs";

export async function GET() {
  console.log("[debug-env] process.env keys:", Object.keys(process.env).sort());

  return NextResponse.json({
    CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    NEXT_PUBLIC_CLOUDINARY_API_KEY: !!process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  });
}
