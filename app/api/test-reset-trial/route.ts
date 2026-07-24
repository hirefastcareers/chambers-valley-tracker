import { NextResponse } from "next/server";
import { auth as clerkAuth } from "@clerk/nextjs/server";
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

async function resolveUserId(request: Request): Promise<string | null> {
  const url = new URL(request.url);
  const paramUserId = url.searchParams.get("userId")?.trim();
  if (paramUserId) return paramUserId;

  const { userId } = await clerkAuth();
  return userId ?? null;
}

export async function GET(request: Request) {
  const authResult = authorised(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, error: authResult.error },
      { status: authResult.error.includes("CRON_SECRET") ? 500 : 401 }
    );
  }

  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "userId query parameter required when not signed in" },
        { status: 400 }
      );
    }

    const sql = getSql();
    const rows = await sql`
      UPDATE users
      SET
        trial_ends_at = NOW() + INTERVAL '14 days',
        subscription_status = 'trialing'
      WHERE id = ${userId}
      RETURNING id;
    `;

    if ((rows as Array<{ id: string }>).length === 0) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: "Trial reset for testing",
      userId,
    });
  } catch (error) {
    console.error("[test-reset-trial] error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
