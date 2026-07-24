import { getSql } from "@/lib/db";

export type AppUser = {
  id: string;
  email: string;
  business_name: string | null;
  trade_type: string | null;
  home_postcode: string | null;
  weekly_target: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  onboarding_completed: boolean | null;
  is_founder: boolean | null;
  created_at: string | null;
};

export async function getUserById(userId: string): Promise<AppUser | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      email,
      business_name,
      trade_type,
      home_postcode,
      weekly_target,
      stripe_customer_id,
      stripe_subscription_id,
      subscription_status,
      trial_ends_at,
      onboarding_completed,
      is_founder,
      created_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1;
  `) as AppUser[];
  return rows[0] ?? null;
}

export async function upsertUserFromClerk(userId: string, email: string) {
  const sql = getSql();
  await sql`
    INSERT INTO users (id, email)
    VALUES (${userId}, ${email})
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  `;
}

export function userNeedsSubscription(user: AppUser | null): boolean {
  if (!user) return false;
  if (user.is_founder) return false;

  const status = user.subscription_status ?? "trialing";
  if (status === "active") return false;

  const trialEnd = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  if (trialEnd && trialEnd > new Date()) return false;
  if (status === "trialing" && !trialEnd) return false;

  return true;
}
