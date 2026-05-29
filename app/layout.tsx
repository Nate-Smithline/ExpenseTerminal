import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import { baseMarketingMetadata } from "../components/SeoJsonLd";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  ...baseMarketingMetadata,
  title: {
    default: baseMarketingMetadata.title as string,
    template: "%s · ExpenseTerminal",
  },
  icons: {
    icon: [
      { url: "/xt-icon.png", type: "image/png", sizes: "32x32" },
      { url: "/xt-icon.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/xt-icon.png",
    apple: "/apple-icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/xt-icon.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-icon" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
