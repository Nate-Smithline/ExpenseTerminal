"use client";

import dynamic from "next/dynamic";

// Dashlane/1Password/etc can inject DOM nodes before hydration, causing mismatch errors.
// Rendering this view client-only avoids server-rendering markup that extensions mutate.
const PageViewClient = dynamic(() => import("./page-view-client").then((m) => m.PageViewClient), {
  ssr: false,
});

export function PageViewClientNoSSR(props: React.ComponentProps<typeof PageViewClient>) {
  return <PageViewClient {...props} />;
}

