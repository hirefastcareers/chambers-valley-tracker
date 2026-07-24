import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/stripe(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/setup(.*)",
  "/api/migrate-multitenancy(.*)",
  "/api/migrate-existing-data(.*)",
  "/api/send-daily-notifications(.*)",
  "/api/set-founder(.*)",
]);

const isSubscriptionExempt = createRouteMatcher([
  "/onboarding(.*)",
  "/subscribe(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/onboarding(.*)",
  "/api/stripe(.*)",
  "/api/webhooks(.*)",
  "/api/migrate(.*)",
  "/api/setup(.*)",
  "/api/send-daily-notifications(.*)",
  "/api/set-founder(.*)",
]);

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }

    const { userId } = await auth();
    if (!userId || isSubscriptionExempt(request)) {
      return NextResponse.next();
    }

    const { getUserById, userNeedsSubscription } = await import("@/lib/user");
    const user = await getUserById(userId);
    if (user?.is_founder) {
      return NextResponse.next();
    }
    if (userNeedsSubscription(user)) {
      const url = request.nextUrl.clone();
      url.pathname = "/subscribe";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  }
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
