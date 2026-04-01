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

export async function POST(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const customerId = Number(body.customerId);
  const followUpDate = body.followUpDate;
  const notes = typeof body.notes === "string" ? body.notes : "";

  if (!Number.isFinite(customerId) || typeof followUpDate !== "string" || !followUpDate) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const sql = getSql();

  const open = await sql`
    SELECT id
    FROM follow_ups
    WHERE customer_id = ${customerId}
      AND completed = false
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  type IdRow = { id: number | string };
  const openTyped = open as IdRow[];
  if (openTyped[0]?.id) {
    await sql`
      UPDATE follow_ups
      SET follow_up_date = ${followUpDate}::date,
          notes = ${notes || null},
          completed = false
      WHERE id = ${openTyped[0].id};
    `;
    await sql`
      INSERT INTO jobs (customer_id, date_done, status, job_type, description, quote_amount, paid, time_of_day)
      VALUES (
        ${customerId},
        ${followUpDate}::date,
        'quoted',
        'Lawn Mow',
        ${notes || null},
        NULL,
        false,
        'all_day'
      );
    `;
    return NextResponse.json({
      ok: true,
      updated: true,
      followUpId: Number(openTyped[0].id),
    });
  }

  const rows = await sql`
    INSERT INTO follow_ups (customer_id, follow_up_date, notes)
    VALUES (${customerId}, ${followUpDate}::date, ${notes || null})
    RETURNING id;
  `;
  await sql`
    INSERT INTO jobs (customer_id, date_done, status, job_type, description, quote_amount, paid, time_of_day)
    VALUES (
      ${customerId},
      ${followUpDate}::date,
      'quoted',
      'Lawn Mow',
      ${notes || null},
      NULL,
      false,
      'all_day'
    );
  `;

  const rowsTyped = rows as IdRow[];
  return NextResponse.json({
    ok: true,
    updated: false,
    followUpId: Number(rowsTyped[0].id),
  });
}

