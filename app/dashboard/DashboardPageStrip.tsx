import Link from "next/link";
import { normalizePageIconColorId, pageIconTextClass } from "@/lib/page-icon-colors";
import type { DashboardStripPage } from "@/lib/dashboard-pages";

export function DashboardPageStrip({ pages }: { pages: DashboardStripPage[] }) {
  if (pages.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-mono-light">Your pages</h2>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
        {pages.map((p) => {
          const href = `/pages/${p.id}`;
          const isMaterial = p.icon_type === "material";
          const colorId = normalizePageIconColorId(p.icon_color);
          return (
            <Link
              key={p.id}
              href={href}
              className="inline-flex min-w-[140px] max-w-[220px] shrink-0 items-center gap-2 rounded-xl border border-bg-tertiary/60 bg-white px-3 py-2.5 text-left shadow-[0_1px_0_rgba(0,0,0,0.04)] transition hover:border-bg-tertiary hover:bg-bg-secondary/30"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-secondary/50 ${pageIconTextClass(
                  colorId,
                )}`}
              >
                {isMaterial ? (
                  <span
                    className="material-symbols-rounded leading-none"
                    style={{
                      fontSize: 20,
                      fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                    }}
                  >
                    {p.icon_value}
                  </span>
                ) : (
                  <span className="text-lg leading-none">{p.icon_value}</span>
                )}
              </span>
              <span className="min-w-0 truncate text-[13px] font-medium text-mono-dark">{p.title}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
