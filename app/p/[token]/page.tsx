import type { Metadata } from "next";
import { PublicPublishedClient } from "./public-published-client";

export const metadata: Metadata = {
  title: "Published view",
  robots: { index: false, follow: false },
};

export default async function PublishedPageRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicPublishedClient token={token} />;
}
