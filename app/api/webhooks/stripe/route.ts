import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ ok: false, error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  const sql = getSql();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    if (userId) {
      await sql`
        UPDATE users
        SET
          subscription_status = 'active',
          stripe_customer_id = COALESCE(${session.customer as string | null}, stripe_customer_id),
          stripe_subscription_id = COALESCE(${session.subscription as string | null}, stripe_subscription_id)
        WHERE id = ${userId};
      `;
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await sql`
      UPDATE users
      SET subscription_status = 'cancelled'
      WHERE stripe_subscription_id = ${subscription.id};
    `;
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionRef = (invoice as Stripe.Invoice & { subscription?: string | { id: string } | null })
      .subscription;
    const subscriptionId =
      typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id ?? null;
    if (subscriptionId) {
      await sql`
        UPDATE users
        SET subscription_status = 'past_due'
        WHERE stripe_subscription_id = ${subscriptionId};
      `;
    }
  }

  return NextResponse.json({ ok: true, received: true });
}
