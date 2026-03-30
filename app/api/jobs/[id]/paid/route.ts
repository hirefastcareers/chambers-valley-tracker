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

export async function PATCH(
  _req: Request,
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
  await sql`
    UPDATE jobs
    SET
      paid = true,
      status = CASE
        WHEN status IN ('quoted', 'booked') THEN 'completed'
        ELSE status
      END
    WHERE id = ${idNum};
  `;

  return NextResponse.json({ ok: true });
}

