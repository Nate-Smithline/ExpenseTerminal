import type { Metadata } from "next";
import { Work_Sans, Marcellus } from "next/font/google";
import "./globals.css";
import { AppShell } from "../components/AppShell";

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
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
    icon: "/icon",
    shortcut: "/icon",
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
        <link rel="icon" href="/icon" type="image/png" sizes="32x32" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className={`${workSans.variable} ${marcellus.variable} antialiased bg-bg-secondary text-mono-dark`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
