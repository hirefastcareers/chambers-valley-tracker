import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const sql = getSql();
  const rows = await sql`
    SELECT note_text, date
    FROM dashboard_notes
    WHERE date = current_date
    LIMIT 1;
  `;

  type Row = { note_text: string | null; date: string };
  const rowsTyped = rows as Row[];
  const note = rowsTyped[0]?.note_text ?? "";

  return NextResponse.json({ ok: true, noteText: note });
}

export async function PUT(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const noteText = typeof body.noteText === "string" ? body.noteText : "";

  const sql = getSql();
  await sql`
    INSERT INTO dashboard_notes (note_text, date)
    VALUES (${noteText}, current_date)
    ON CONFLICT (date)
    DO UPDATE SET note_text = EXCLUDED.note_text;
  `;

  return NextResponse.json({ ok: true });
}

