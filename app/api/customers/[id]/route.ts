import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import type { NextRequest } from "next/server";
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const { id } = await params;
  const rawId = String(id ?? "");
  const idMatch = rawId.match(/\d+/);
  const idNum = idMatch ? Number(idMatch[0]) : NaN;
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    SELECT id, name, address, distance_miles, phone, email, notes, tags, created_at
    FROM customers
    WHERE id = ${idNum}
      AND user_id = ${userId}
    LIMIT 1;
  `;
  type CustomerRow = {
    id: number | string;
    name: string;
    address: string | null;
    distance_miles: string | number | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    tags: string[] | null;
    created_at: unknown;
  };

  const rowsTyped = rows as CustomerRow[];
  const customer = rowsTyped[0];
  if (!customer) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, customer });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const { id } = await params;
  const rawId = String(id ?? "");
  const idMatch = rawId.match(/\d+/);
  const idNum = idMatch ? Number(idMatch[0]) : NaN;
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const { name, address, phone, email, notes, tags, distance_miles } = body as {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    notes?: string;
    tags?: unknown;
    distance_miles?: number | null;
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
    : null;

  const sql = getSql();
  const existingRows = await sql`
    SELECT distance_miles, address
    FROM customers
    WHERE id = ${idNum}
      AND user_id = ${userId}
    LIMIT 1;
  `;
  const existingRow = (existingRows as Array<{ distance_miles: string | number | null; address: string | null }>)[0];
  if (!existingRow) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const existingDistanceRaw = existingRow.distance_miles;
  const hadDistanceBefore = Number.isFinite(Number(existingDistanceRaw ?? NaN));
  const previousAddress = existingRow.address ?? null;

  const homePostcode = await getHomePostcode(sql, userId);
  const autoDistanceMiles = await calculateDrivingMiles(homePostcode, address ?? null);
  const distanceMiles =
    typeof distance_miles === "number" && Number.isFinite(distance_miles) ? distance_miles : autoDistanceMiles;
  await sql`
    UPDATE customers
    SET name = ${name.trim()},
        address = ${address ?? null},
        distance_miles = ${distanceMiles},
        phone = ${phone ?? null},
        email = ${email ?? null},
        notes = ${notes ?? null},
        tags = COALESCE(${normalisedTags}::text[], tags)
    WHERE id = ${idNum}
      AND user_id = ${userId};
  `;

  if (!hadDistanceBefore && Number.isFinite(Number(distanceMiles ?? NaN))) {
    const returnMiles = Math.round(Number(distanceMiles) * 2 * 10) / 10;
    await sql`
      UPDATE jobs
      SET mileage_miles = ${returnMiles}
      WHERE customer_id = ${idNum}
        AND user_id = ${userId}
        AND mileage_miles IS NULL;
    `;
  }

  const nextAddress = address ?? null;
  if (String(previousAddress ?? "").trim() !== String(nextAddress ?? "").trim()) {
    await syncCustomerGeocode(sql, idNum, nextAddress);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const { id } = await params;
  const rawId = String(id ?? "");
  const idMatch = rawId.match(/\d+/);
  const idNum = idMatch ? Number(idMatch[0]) : NaN;
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    DELETE FROM customers
    WHERE id = ${idNum}
      AND user_id = ${userId}
    RETURNING id;
  `;

  type DeleteRow = { id: number | string | bigint };
  const rowsTyped = rows as DeleteRow[];
  const deletedIdRaw = rowsTyped[0]?.id;
  const deletedId =
    deletedIdRaw === undefined || deletedIdRaw === null
      ? null
      : typeof deletedIdRaw === "bigint"
        ? Number(deletedIdRaw)
        : Number(deletedIdRaw);

  if (!deletedId || !Number.isFinite(deletedId)) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
