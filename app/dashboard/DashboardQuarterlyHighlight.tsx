"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Scrolls to estimated quarterly payment when ?highlight=quarterly (e.g. email deep link). */
export function DashboardQuarterlyHighlight() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("highlight") !== "quarterly") return;
    const el = document.getElementById("quarterly-estimated-tax");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-sovereign-blue/40");
      const t = window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-sovereign-blue/40");
      }, 4000);
      return () => window.clearTimeout(t);
    }
  }, [searchParams]);

  return null;
}
