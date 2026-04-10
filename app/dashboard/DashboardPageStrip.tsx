"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardPageStripItem } from "@/lib/dashboard-pages";
import { normalizePageIconColorId, pageIconSwatchFillClass, pageIconTextClass } from "@/lib/page-icon-colors";

function useRelativeUpdatedLabel(iso: string): string {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function formatOnce() {
      try {
        const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
        const then = new Date(iso).getTime();
        const now = Date.now();
        let diffSec = Math.round((then - now) / 1000);
        const abs = Math.abs(diffSec);
        let value = diffSec;
        let unit: Intl.RelativeTimeFormatUnit = "second";
        if (abs < 60) {
          unit = "second";
        } else if (abs < 3600) {
          value = Math.round(diffSec / 60);
          unit = "minute";
        } else if (abs < 86400) {
          value = Math.round(diffSec / 3600);
          unit = "hour";
        } else if (abs < 604800) {
          value = Math.round(diffSec / 86400);
          unit = "day";
        } else if (abs < 2592000) {
          value = Math.round(diffSec / 604800);
          unit = "week";
        } else if (abs < 31536000) {
          value = Math.round(diffSec / 2592000);
          unit = "month";
        } else {
          value = Math.round(diffSec / 31536000);
          unit = "year";
        }
        setLabel(rtf.format(value, unit));
      } catch {
        setLabel("");
      }
    }
    formatOnce();
    const id = window.setInterval(formatOnce, 60_000);
    return () => window.clearInterval(id);
  }, [iso]);

  return label;
}

function StripCard({ page }: { page: DashboardPageStripItem }) {
  const rel = useRelativeUpdatedLabel(page.updated_at);
  const colorId = normalizePageIconColorId(page.icon_color);
  const cover = pageIconSwatchFillClass(colorId);
  const isMaterial = page.icon_type === "material";
  const iconValue =
    typeof page.icon_value === "string" && page.icon_value.length > 0
      ? page.icon_value
      : isMaterial
        ? "description"
        : "📄";

  return (
    <Link
      href={`/pages/${encodeURIComponent(page.id)}`}
      className="group flex w-[148px] shrink-0 flex-col overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-sm transition hover:border-black/[0.12] hover:shadow-md"
    >
      <div className={`h-14 w-full ${cover} opacity-90`} aria-hidden />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-md bg-[#f5f5f7] ${pageIconTextClass(colorId)}`}>
            {isMaterial ? (
              <span
                className="material-symbols-rounded text-[16px] leading-none"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
              >
                {iconValue}
              </span>
            ) : (
              <span className="text-[14px] leading-none">{iconValue}</span>
            )}
          </span>
          <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-mono-dark line-clamp-2">
            {page.title}
          </span>
        </div>
        {rel ? <p className="text-[11px] text-mono-light">{rel}</p> : null}
      </div>
    </Link>
  );
}

export function DashboardPageStrip({ pages }: { pages: DashboardPageStripItem[] }) {
  if (pages.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-mono-light">Pages</h2>
      <div className="-mx-1 flex gap-3 overflow-x-auto pb-1 pt-0.5 px-1">
        {pages.map((p) => (
          <StripCard key={p.id} page={p} />
        ))}
      </div>
    </section>
  );
}
