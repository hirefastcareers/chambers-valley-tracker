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

type TableResult = { ok: true } | { ok: false; error: string };

export async function GET(request: Request) {
  const auth = authorised(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.error.includes("CRON_SECRET") ? 500 : 401 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId query parameter required" }, { status: 400 });
  }

  try {
    const sql = getSql();
    const results: Record<string, TableResult> = {};

    async function runStep(name: string, step: () => Promise<void>) {
      try {
        await step();
        results[name] = { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[migrate-existing-data] ${name} failed:`, error);
        results[name] = { ok: false, error: message };
      }
    }

    await runStep("customers", async () => {
      await sql`UPDATE customers SET user_id = ${userId} WHERE user_id IS NULL`;
    });

    await runStep("jobs", async () => {
      await sql`UPDATE jobs SET user_id = ${userId} WHERE user_id IS NULL`;
    });

    await runStep("follow_ups", async () => {
      await sql`UPDATE follow_ups SET user_id = ${userId} WHERE user_id IS NULL`;
    });

    await runStep("recurring_reminders", async () => {
      await sql`UPDATE recurring_reminders SET user_id = ${userId} WHERE user_id IS NULL`;
    });

    await runStep("quotes", async () => {
      await sql`UPDATE quotes SET user_id = ${userId} WHERE user_id IS NULL`;
    });

    await runStep("photos_from_jobs", async () => {
      await sql`
        UPDATE photos p
        SET user_id = j.user_id
        FROM jobs j
        WHERE p.job_id = j.id
          AND p.user_id IS NULL
          AND j.user_id IS NOT NULL
      `;
      await sql`UPDATE photos SET user_id = ${userId} WHERE user_id IS NULL`;
    });

    await runStep("dashboard_notes", async () => {
      const tableExists = await sql`
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'dashboard_notes'
        LIMIT 1
      `;
      if ((tableExists as unknown[]).length === 0) {
        return;
      }
      await sql`UPDATE dashboard_notes SET user_id = ${userId} WHERE user_id IS NULL`;
    });

    await runStep("settings", async () => {
      const columnExists = await sql`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'settings'
          AND column_name = 'user_id'
        LIMIT 1
      `;
      if ((columnExists as unknown[]).length === 0) {
        return;
      }

      // Drop legacy global rows when this user already has per-user settings for the same key.
      await sql`
        DELETE FROM settings s1
        WHERE s1.user_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM settings s2
            WHERE s2.key = s1.key
              AND s2.user_id = ${userId}
          )
      `;

      await sql`
        UPDATE settings
        SET user_id = ${userId}
        WHERE user_id IS NULL
      `;
    });

    const failed = Object.entries(results).filter(([, r]) => !r.ok);
    if (failed.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          userId,
          error: failed.map(([name, r]) => `${name}: ${"error" in r ? r.error : "unknown"}`).join("; "),
          results,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      userId,
      message: "All rows with NULL user_id assigned to user",
      results,
    });
  } catch (error) {
    console.error("[migrate-existing-data] error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
