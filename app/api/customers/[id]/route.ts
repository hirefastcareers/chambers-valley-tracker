import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import type { NextRequest } from "next/server";
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

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
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

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
  const settingsRows = await sql`
    SELECT value
    FROM settings
    WHERE key = 'home_postcode'
    LIMIT 1;
  `;
  const homePostcode = String((settingsRows as Array<{ value: string }>)[0]?.value ?? "");
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
    WHERE id = ${idNum};
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

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

