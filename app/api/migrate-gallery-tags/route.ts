import { env } from "node:process";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireUserIdApi } from "@/lib/auth";

export const runtime = "nodejs";

const ADD_TAG_CHUNK = 100;
const SEARCH_PAGE_SIZE = 500;

type SearchResource = { public_id: string };

async function fetchPublicIdsByExpression(expression: string): Promise<string[]> {
  const publicIds: string[] = [];
  let nextCursor: string | undefined;

  do {
    let query = cloudinary.search
      .expression(expression)
      .max_results(SEARCH_PAGE_SIZE)
      .with_field("tags");

    if (nextCursor) {
      query = query.next_cursor(nextCursor);
    }

    const result = await query.execute();
    const resources = (result.resources ?? []) as SearchResource[];
    for (const resource of resources) {
      if (resource.public_id) {
        publicIds.push(resource.public_id);
      }
    }
    nextCursor = result.next_cursor as string | undefined;
  } while (nextCursor);

  return [...new Set(publicIds)];
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

export async function GET() {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;

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

  let beforePublicIds: string[] = [];
  let afterPublicIds: string[] = [];

  try {
    beforePublicIds = await fetchPublicIdsByExpression("tags=before AND tags=patch");
    afterPublicIds = await fetchPublicIdsByExpression("tags=after AND tags=patch");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[migrate-gallery-tags] Cloudinary search failed.", message);
    return NextResponse.json(
      { ok: false, error: "Cloudinary search failed.", detail: message },
      { status: 500 }
    );
  }

  let before_tagged = 0;
  let after_tagged = 0;

  try {
    if (beforePublicIds.length > 0) {
      await batchAddTag("gallery", beforePublicIds);
      before_tagged = beforePublicIds.length;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[migrate-gallery-tags] batch gallery tag (before) failed.", message);
    return NextResponse.json(
      { ok: false, error: "Failed to add gallery tag to before photos.", detail: message },
      { status: 500 }
    );
  }

  try {
    if (afterPublicIds.length > 0) {
      await batchAddTag("gallery", afterPublicIds);
      after_tagged = afterPublicIds.length;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[migrate-gallery-tags] batch gallery tag (after) failed.", message);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to add gallery tag to after photos.",
        detail: message,
        before_tagged,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    before_tagged,
    after_tagged,
  });
}
