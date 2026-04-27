import localFont from "next/font/local";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import "./brand-scope.css";

const satoshi = localFont({
  src: "../../satoshi/Fonts/WEB/fonts/Satoshi-Variable.woff2",
  weight: "300 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Brand",
  robots: { index: false, follow: false },
};

function isLocalHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const forwarded = h.get("x-forwarded-host");
  const direct = h.get("host");
  const host = forwarded ?? direct;
  if (!isLocalHost(host)) {
    notFound();
  }

  return (
    <div
      className={`brand-satoshi-only ${satoshi.className} min-h-screen bg-[rgb(242,242,247)] text-black antialiased`}
    >
      {children}
    </div>
  );
}
