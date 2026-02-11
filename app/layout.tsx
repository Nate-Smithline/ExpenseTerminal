import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "../components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Business Deduction Tracker",
  description: "Inbox-first tax deduction tracker for small businesses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased bg-bg-secondary text-mono-dark`}>
        <div className="min-h-screen flex bg-bg-secondary">
          <Sidebar />
          <main className="flex-1 px-12 py-12 bg-bg-secondary">
            <div className="max-w-[1400px] mx-auto">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
