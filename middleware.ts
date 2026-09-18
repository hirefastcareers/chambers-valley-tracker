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
  "/api/migrate-gallery-tags(.*)",
  "/api/gallery-pairs(.*)",
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

/** Short-lived gate so we skip a Neon round-trip on every nav/API call. */
const SUB_OK_COOKIE = "patch_sub_ok";
const SUB_OK_MAX_AGE_SEC = 120;

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }

    const { userId } = await auth();
    if (!userId || isSubscriptionExempt(request)) {
      return NextResponse.next();
    }

    if (request.cookies.get(SUB_OK_COOKIE)?.value === "1") {
      return NextResponse.next();
    }

    const { getUserByIdUncached, userNeedsSubscription } = await import("@/lib/user");
    const user = await getUserByIdUncached(userId);
    if (user?.is_founder || !userNeedsSubscription(user)) {
      const res = NextResponse.next();
      res.cookies.set(SUB_OK_COOKIE, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SUB_OK_MAX_AGE_SEC,
      });
      return res;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/subscribe";
    const redirect = NextResponse.redirect(url);
    redirect.cookies.set(SUB_OK_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return redirect;
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  }
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
