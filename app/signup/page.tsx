"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { SignupOnboardingWizard } from "@/app/onboarding/SignupOnboardingWizard";

function SignupFallback() {
  return (
    <div className="mx-auto w-full max-w-xl animate-pulse space-y-4 py-8">
      <div className="h-1.5 rounded-full bg-frost" />
      <div className="h-40 rounded-[var(--radius-lg)] bg-frost" />
    </div>
  );
}

function SignupWithShortcuts() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        router.push("/login");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <div className="relative w-full min-w-0 max-w-full">
      <AuthLayout contentClassName="max-w-xl" showLogo={false}>
        <SignupOnboardingWizard variant="embedded" />
      </AuthLayout>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupWithShortcuts />
    </Suspense>
  );
}
