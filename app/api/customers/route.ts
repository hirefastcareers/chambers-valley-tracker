import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const forDropdown = searchParams.get("forDropdown") === "1";
  const search = (searchParams.get("search") ?? "").trim();

  const sql = getSql();

  if (forDropdown) {
    const rows = await sql`
      SELECT id, name
      FROM customers
      ORDER BY name ASC;
    `;
    return NextResponse.json({ customers: rows });
  }

  const query = search
    ? sql`
        WHERE c.name ILIKE ${`%${search}%`}
           OR c.phone ILIKE ${`%${search}%`}
           OR c.email ILIKE ${`%${search}%`}
           OR c.address ILIKE ${`%${search}%`}
      `
    : sql``;

  const rows = await sql`
    SELECT
      c.id,
      c.name,
      c.phone,
      (
        SELECT MIN(fu.follow_up_date)
        FROM follow_ups fu
        WHERE fu.customer_id = c.id
          AND fu.completed = false
      ) AS next_follow_up_date
    FROM customers c
    ${query}
    ORDER BY c.name ASC;
  `;

  return NextResponse.json({ customers: rows });
}

export async function POST(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const { name, address, phone, email, notes } = body as {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    notes?: string;
  };

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    INSERT INTO customers (name, address, phone, email, notes)
    VALUES (${name.trim()}, ${address ?? null}, ${phone ?? null}, ${email ?? null}, ${notes ?? null})
    RETURNING id;
  `;

  type InsertRow = { id: number | string | bigint };
  const rowsTyped = rows as InsertRow[];
  const insertIdRaw = rowsTyped[0]?.id;

  if (insertIdRaw === undefined || insertIdRaw === null) {
    return NextResponse.json(
      { ok: false, error: "Could not create customer (missing id)" },
      { status: 500 }
    );
  }

  const customerId = typeof insertIdRaw === "bigint" ? Number(insertIdRaw) : Number(insertIdRaw);
  if (!Number.isFinite(customerId)) {
    return NextResponse.json(
      { ok: false, error: "Could not create customer (invalid id returned)" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, customerId });
}

