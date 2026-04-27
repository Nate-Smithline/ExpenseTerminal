import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { LandingPage } from "./LandingPage";
import { FaqJsonLd } from "@/components/SeoJsonLd";

export const metadata: Metadata = {
  title: "ExpenseTerminal — Tax deductions and quarterly estimates for self‑employed workers",
  description:
    "Connect your bank, review write-offs in plain English, and see estimated quarterly payments — built for freelancers, creators, and side hustles.",
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
              "ExpenseTerminal helps self-employed workers connect bank accounts, review AI-suggested business categories, track write-offs, and see estimated quarterly tax amounts — with exports you can share with a tax preparer.",
          },
          {
            question: "Who is ExpenseTerminal for?",
            answer:
              "ExpenseTerminal is built for self-employed professionals, freelancers, and small business owners who want a simple way to track expenses and capture every eligible tax deduction without building complex spreadsheets.",
          },
          {
            question: "How does ExpenseTerminal help with tax deductions?",
            answer:
              "It syncs transactions, suggests categories in plain language, and supports calculated deductions like mileage and home office. You get totals by category and estimated quarterly payment hints based on your data and settings (not personalized tax advice).",
          },
        ]}
      />
      <LandingPage />
    </>
  );
}
