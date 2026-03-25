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

type LineItemInput = { description: string; price: number };

export async function POST(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const customerId = Number(body.customerId);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes : null;
  const validUntil = typeof body.validUntil === "string" && body.validUntil.trim() ? body.validUntil.trim() : null;

  const totalAmount = Number(body.totalAmount);
  const lineItemsRaw = Array.isArray(body.lineItems) ? (body.lineItems as LineItemInput[]) : [];

  if (!Number.isFinite(customerId) || description.length === 0 || !Number.isFinite(totalAmount)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const lineItems = lineItemsRaw
    .map((li) => ({
      description: typeof li?.description === "string" ? li.description.trim() : "",
      price: Number(li?.price),
    }))
    .filter((li) => li.description.length > 0 && Number.isFinite(li.price));

  if (lineItems.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one line item is required" }, { status: 400 });
  }

  const sql = getSql();
  const lineItemsJson = JSON.stringify(lineItems);
  const rows = await sql`
    INSERT INTO quotes (customer_id, description, line_items, total_amount, notes, valid_until)
    VALUES (
      ${customerId},
      ${description},
      ${lineItemsJson}::jsonb,
      ${totalAmount},
      ${notes ?? null},
      ${validUntil ?? null}::date
    )
    RETURNING id;
  `;

  type Row = { id: number | string | bigint };
  const rowsTyped = rows as Row[];
  const idRaw = rowsTyped[0]?.id;
  const quoteId = typeof idRaw === "bigint" ? Number(idRaw) : Number(idRaw);
  if (!Number.isFinite(quoteId)) {
    return NextResponse.json({ ok: false, error: "Could not save quote" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, quoteId });
}

