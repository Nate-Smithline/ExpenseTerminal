import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import { baseMarketingMetadata } from "../components/SeoJsonLd";

const satoshi = localFont({
  src: [
    {
      path: "../satoshi/Fonts/WEB/fonts/Satoshi-Variable.woff2",
      style: "normal",
    },
    {
      path: "../satoshi/Fonts/WEB/fonts/Satoshi-VariableItalic.woff2",
      style: "italic",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  ...baseMarketingMetadata,
  icons: {
    icon: [
      { url: "/xt-icon.png", type: "image/png", sizes: "32x32" },
      { url: "/xt-icon.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/xt-icon.png",
    apple: "/xt-icon.png",
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
        <link rel="apple-touch-icon" href="/xt-icon.png" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className={`${satoshi.variable} antialiased bg-bg-primary text-mono-dark font-sans`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
