import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--c-bg)]">
      <SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/onboarding" />
    </div>
  );
}
