import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import type { NextRequest } from "next/server";

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
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    SELECT id, name, address, phone, email, notes, created_at
    FROM customers
    WHERE id = ${idNum}
    LIMIT 1;
  `;
  type CustomerRow = {
    id: number | string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
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
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

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
  await sql`
    UPDATE customers
    SET name = ${name.trim()},
        address = ${address ?? null},
        phone = ${phone ?? null},
        email = ${email ?? null},
        notes = ${notes ?? null}
    WHERE id = ${idNum};
  `;

  return NextResponse.json({ ok: true });
}

