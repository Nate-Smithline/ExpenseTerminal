"use client";

import dynamic from "next/dynamic";

// Dashlane/1Password/etc can inject DOM nodes before hydration, causing mismatch errors.
// Rendering this view client-only avoids server-rendering markup that extensions mutate.
const PageViewClient = dynamic(
  () => import("./page-view-client").then((m) => ({ default: m.PageViewClient })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center px-5 text-[13px] text-mono-light">
        Loading activity…
      </div>
    ),
  },
);

export type PageViewServerPage = {
  id: string;
  title: string | null;
  icon_type: string | null;
  icon_value: string | null;
  icon_color: string | null;
  full_width: boolean;
  favorited: boolean;
};

export function PageViewClientNoSSR({ page }: { page: PageViewServerPage }) {
  return <PageViewClient page={page} />;
}
