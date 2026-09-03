import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { toE164Uk } from "@/lib/format";

export const runtime = "nodejs";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayISODateForFilename() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

type CustomerPhoneRow = {
  name: string;
  phone: string | null;
  email: string | null;
};

export async function GET(req: Request) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();

  const sql = getSql();
  const rows = (await sql`
    SELECT name, phone, email
    FROM customers
    WHERE user_id = ${userId}
      AND phone IS NOT NULL
      AND TRIM(phone) <> ''
    ORDER BY LOWER(TRIM(name)) ASC;
  `) as CustomerPhoneRow[];

  const stamp = todayISODateForFilename();

  if (format === "txt") {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const e164 = toE164Uk(r.phone ?? "");
      if (!e164 || seen.has(e164)) continue;
      seen.add(e164);
      unique.push(e164);
    }
    const body = unique.join("\r\n");
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="patch-customer-numbers-${stamp}.txt"`,
      },
    });
  }

  const header = "Name,Phone,E164,Email";
  const lines = rows.map((r) => {
    const phone = (r.phone ?? "").trim();
    return [
      csvEscape(r.name ?? ""),
      csvEscape(phone),
      csvEscape(toE164Uk(phone)),
      csvEscape((r.email ?? "").trim()),
    ].join(",");
  });
  const csv = [header, ...lines].join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="patch-customer-numbers-${stamp}.csv"`,
    },
  });
}
