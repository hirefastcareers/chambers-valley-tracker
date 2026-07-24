import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

function getCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret || null;
}

function authorised(request: Request): { ok: true } | { ok: false; error: string } {
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return { ok: false, error: "CRON_SECRET is not configured on the server" };
  }

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const bearerToken = authHeader?.match(/^\s*Bearer\s+(\S+)\s*$/i)?.[1]?.trim();
  if (bearerToken === cronSecret) {
    return { ok: true };
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim();
  if (querySecret === cronSecret) {
    return { ok: true };
  }

  return { ok: false, error: "Unauthorised" };
}

export async function GET(request: Request) {
  const authResult = authorised(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, error: authResult.error },
      { status: authResult.error.includes("CRON_SECRET") ? 500 : 401 }
    );
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId query parameter required" }, { status: 400 });
  }

  try {
    const sql = getSql();
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT FALSE;`;

    const rows = await sql`
      UPDATE users
      SET is_founder = true
      WHERE id = ${userId}
      RETURNING id, is_founder;
    `;

    if ((rows as Array<{ id: string }>).length === 0) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: "Founder flag set",
      userId,
    });
  } catch (error) {
    console.error("[set-founder] error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
