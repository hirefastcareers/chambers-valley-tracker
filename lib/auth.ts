import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function getUserId() {
  const { userId } = await auth();
  return userId;
}

export async function requireAuth(): Promise<string> {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) {
    redirectToSignIn();
    throw new Error("Unauthenticated");
  }
  return userId;
}

export async function requireUserIdApi(): Promise<
  { userId: string; error: null } | { userId: null; error: NextResponse }
> {
  const { userId } = await auth();
  if (!userId) {
    return {
      userId: null,
      error: NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 }),
    };
  }
  return { userId, error: null };
}

export async function requireCronOrUserApi(request: Request): Promise<
  { userId: string | null; error: null; isCron: boolean } | { userId: null; error: NextResponse; isCron: false }
> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = authHeader?.match(/^\s*Bearer\s+(\S+)\s*$/i)?.[1]?.trim();
  if (cronSecret && token === cronSecret) {
    return { userId: null, error: null, isCron: true };
  }

  const authResult = await requireUserIdApi();
  if (authResult.error) {
    return { userId: null, error: authResult.error, isCron: false };
  }
  return { userId: authResult.userId, error: null, isCron: false };
}

export async function requireOnboardingComplete(userId: string) {
  const { getUserById } = await import("@/lib/user");
  const user = await getUserById(userId);
  if (!user?.onboarding_completed) {
    redirect("/onboarding");
  }
}
