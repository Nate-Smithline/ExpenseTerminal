import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { LandingPage } from "./LandingPage";
import { FaqJsonLd } from "@/components/SeoJsonLd";

export const metadata: Metadata = {
  title: "ExpenseTerminal — AI-powered expense tracking for self‑employed tax deductions",
  description:
    "Streamlined expense review and tax deduction software that helps self-employed professionals and small businesses categorize transactions, track write-offs, and export audit-ready reports.",
  alternates: {
    canonical: "https://expenseterminal.com/",
  },
};

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <>
      <FaqJsonLd
        items={[
          {
            question: "What is ExpenseTerminal?",
            answer:
              "ExpenseTerminal is an AI-powered expense tracking and tax deduction platform for self-employed professionals and small businesses. It helps you categorize transactions, organize receipts, and prepare audit-ready reports so you can keep more of what you earn at tax time.",
          },
          {
            question: "Who is ExpenseTerminal for?",
            answer:
              "ExpenseTerminal is built for self-employed professionals, freelancers, and small business owners who want a simple way to track expenses and capture every eligible tax deduction without building complex spreadsheets.",
          },
          {
            question: "How does ExpenseTerminal help with tax deductions?",
            answer:
              "ExpenseTerminal connects to your financial data or CSV uploads, uses AI to map transactions to IRS-friendly categories, and tracks key deduction areas like mileage, home office, and health insurance. It then generates audit-friendly reports that mirror what tax preparers expect.",
          },
        ]}
      />
      <LandingPage />
    </>
  );
}
