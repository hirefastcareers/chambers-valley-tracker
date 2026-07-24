import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserById } from "@/lib/user";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  const user = await getUserById(userId);
  if (!user?.stripe_customer_id) {
    return NextResponse.json({ ok: false, error: "No Stripe customer on file" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${appUrl}/settings`,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
