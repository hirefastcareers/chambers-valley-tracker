import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { normalizePhoneToDigits, toE164Uk } from "@/lib/format";

export const runtime = "nodejs";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayISODateForFilename() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Strip directional marks / NBSP / other junk pasted from phones or WhatsApp. */
function cleanPhoneSource(phone: string): string {
  return phone
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "")
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .trim();
}

function formatUkPhoneDisplay(phone: string): string {
  const digits = normalizePhoneToDigits(phone);
  if (!digits) return "";

  let national = digits;
  if (digits.startsWith("44") && digits.length >= 12) {
    national = `0${digits.slice(2)}`;
  }
  if (national.length === 11 && national.startsWith("0")) {
    return `${national.slice(0, 5)} ${national.slice(5, 8)} ${national.slice(8)}`;
  }
  return national;
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
      const e164 = toE164Uk(cleanPhoneSource(r.phone ?? ""));
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
    const phone = cleanPhoneSource(r.phone ?? "");
    const display = formatUkPhoneDisplay(phone);
    const e164 = toE164Uk(phone);
    return [
      csvEscape(r.name ?? ""),
      csvEscape(display),
      csvEscape(e164),
      csvEscape((r.email ?? "").trim()),
    ].join(",");
  });
  // BOM so Excel opens as UTF-8 instead of Windows-1252 (which turns + / spaces into â€ª Â etc).
  const csv = `\uFEFF${[header, ...lines].join("\r\n")}`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="patch-customer-numbers-${stamp}.csv"`,
    },
  });
}
