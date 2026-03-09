import type { Metadata } from "next";
import localFont from "next/font/local";
import { Marcellus } from "next/font/google";
import "./globals.css";
import { AppShell } from "../components/AppShell";

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

const marcellus = Marcellus({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "ExpenseTerminal — Business Deduction Tracker",
  description: "Inbox-first tax deduction tracker for small businesses",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "32x32" }, { url: "/icon.png", type: "image/png", sizes: "192x192" }],
    shortcut: "/icon.png",
    apple: "/icon.png",
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
        <link rel="icon" href="/icon.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className={`${satoshi.variable} ${marcellus.variable} antialiased bg-bg-primary text-mono-dark font-sans`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
