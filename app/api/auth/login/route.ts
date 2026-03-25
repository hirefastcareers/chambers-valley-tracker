import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { requiredEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const password: unknown = body?.password;

  if (typeof password !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const expected = requiredEnv("APP_PASSWORD");
  if (password !== expected) {
    return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const thirtyDays = 60 * 60 * 24 * 30;
  res.cookies.set(AUTH_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: thirtyDays,
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}

