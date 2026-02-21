"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  children: React.ReactNode;
};

export function BackToDeductionsLink({ children }: Props) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        router.push("/other-deductions");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <Link href="/other-deductions" className="btn-secondary text-sm inline-flex items-center gap-1.5">
      {children}
      <kbd className="kbd-hint">Esc</kbd>
    </Link>
  );
}
