import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireUserIdApi } from "@/lib/auth";
import { calculateDrivingMiles } from "@/lib/distance";
import { syncCustomerGeocode } from "@/lib/customerGeocode";

export const runtime = "nodejs";

async function getHomePostcode(sql: ReturnType<typeof getSql>, userId: string): Promise<string> {
  const userRows = await sql`
    SELECT home_postcode
    FROM users
    WHERE id = ${userId}
    LIMIT 1;
  `;
  let homePostcode = String((userRows as Array<{ home_postcode: string | null }>)[0]?.home_postcode ?? "");
  if (!homePostcode) {
    const settingsRows = await sql`
      SELECT value
      FROM settings
      WHERE key = 'home_postcode'
        AND user_id = ${userId}
      LIMIT 1;
    `;
    homePostcode = String((settingsRows as Array<{ value: string }>)[0]?.value ?? "");
  }
  return homePostcode;
}

export async function GET(req: Request) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

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
      WHERE user_id = ${userId}
      ORDER BY LOWER(TRIM(name)) ASC;
    `;
    return NextResponse.json({ customers: rows });
  }

  const baseFilter = sql`WHERE c.user_id = ${userId}`;
  const query =
    search && tag
      ? sql`${baseFilter}
        AND (c.name ILIKE ${`%${search}%`}
           OR c.phone ILIKE ${`%${search}%`}
           OR c.email ILIKE ${`%${search}%`}
           OR c.address ILIKE ${`%${search}%`}
        )
        AND c.tags @> ARRAY[${tag}]::text[]`
      : search
        ? sql`${baseFilter}
          AND (c.name ILIKE ${`%${search}%`}
             OR c.phone ILIKE ${`%${search}%`}
             OR c.email ILIKE ${`%${search}%`}
             OR c.address ILIKE ${`%${search}%`}
          )`
        : tag
          ? sql`${baseFilter} AND c.tags @> ARRAY[${tag}]::text[]`
          : baseFilter;

  const rows = await sql`
    SELECT
      c.id,
      c.name,
      c.phone,
      c.address,
      c.email,
      c.created_at,
      c.distance_miles,
      c.tags,
      lj.job_type AS last_job_type,
      lj.date_done AS last_job_date,
      (
        SELECT MIN(fu.follow_up_date)
        FROM follow_ups fu
        WHERE fu.customer_id = c.id
          AND fu.user_id = ${userId}
          AND fu.completed = false
      ) AS next_follow_up_date,
      (
        SELECT AVG((g.nxt - g.curr)::numeric)
        FROM (
          SELECT
            jf.date_done::date AS curr,
            LEAD(jf.date_done::date) OVER (
              ORDER BY jf.date_done ASC, jf.created_at ASC
            ) AS nxt
          FROM jobs jf
          WHERE jf.customer_id = c.id
            AND jf.user_id = ${userId}
            AND jf.status = 'completed'
            AND jf.date_done IS NOT NULL
        ) g
        WHERE g.nxt IS NOT NULL
      ) AS avg_visit_gap_days
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT j.job_type, j.date_done
      FROM jobs j
      WHERE j.customer_id = c.id
        AND j.user_id = ${userId}
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
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

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
  const homePostcode = await getHomePostcode(sql, userId);
  const distanceMiles = await calculateDrivingMiles(homePostcode, address ?? null);
  const rows = await sql`
    INSERT INTO customers (user_id, name, address, distance_miles, phone, email, notes, tags)
    VALUES (
      ${userId},
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

  await syncCustomerGeocode(sql, customerId, address ?? null);

  return NextResponse.json({ ok: true, customerId });
}
