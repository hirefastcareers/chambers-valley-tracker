import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";
import { calculateDrivingMiles } from "@/lib/distance";

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
  const tag = (searchParams.get("tag") ?? "").trim();

  const sql = getSql();

  if (forDropdown) {
    const rows = await sql`
      SELECT id, name, phone, address, email, distance_miles
      FROM customers
      ORDER BY LOWER(TRIM(name)) ASC;
    `;
    return NextResponse.json({ customers: rows });
  }

  const query = search && tag
    ? sql`
        WHERE (c.name ILIKE ${`%${search}%`}
           OR c.phone ILIKE ${`%${search}%`}
           OR c.email ILIKE ${`%${search}%`}
           OR c.address ILIKE ${`%${search}%`}
        )
        AND c.tags @> ARRAY[${tag}]::text[]
      `
    : search
      ? sql`
          WHERE c.name ILIKE ${`%${search}%`}
             OR c.phone ILIKE ${`%${search}%`}
             OR c.email ILIKE ${`%${search}%`}
             OR c.address ILIKE ${`%${search}%`}
        `
      : tag
        ? sql`WHERE c.tags @> ARRAY[${tag}]::text[]`
        : sql``;

  const rows = await sql`
    SELECT
      c.id,
      c.name,
      c.phone,
      c.address,
      c.email,
      c.distance_miles,
      c.tags,
      lj.job_type AS last_job_type,
      lj.date_done AS last_job_date,
      (
        SELECT MIN(fu.follow_up_date)
        FROM follow_ups fu
        WHERE fu.customer_id = c.id
          AND fu.completed = false
      ) AS next_follow_up_date
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT j.job_type, j.date_done
      FROM jobs j
      WHERE j.customer_id = c.id
        AND j.status = 'completed'
      ORDER BY j.date_done DESC NULLS LAST, j.created_at DESC
      LIMIT 1
    ) lj ON TRUE
    ${query}
    ORDER BY LOWER(TRIM(c.name)) ASC;
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

  const { name, address, phone, email, notes, tags } = body as {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    notes?: string;
    tags?: unknown;
  };

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  }

  const normalisedTags = Array.isArray(tags)
    ? Array.from(
        new Set(
          tags
            .map((t) => (typeof t === "string" ? t.trim() : ""))
            .filter((t) => t.length > 0)
        )
      )
    : [];

  const sql = getSql();
  const settingsRows = await sql`
    SELECT value
    FROM settings
    WHERE key = 'home_postcode'
    LIMIT 1;
  `;
  const homePostcode = String((settingsRows as Array<{ value: string }>)[0]?.value ?? "");
  const distanceMiles = await calculateDrivingMiles(homePostcode, address ?? null);
  const rows = await sql`
    INSERT INTO customers (name, address, distance_miles, phone, email, notes, tags)
    VALUES (
      ${name.trim()},
      ${address ?? null},
      ${distanceMiles},
      ${phone ?? null},
      ${email ?? null},
      ${notes ?? null},
      ${normalisedTags}::text[]
    )
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

