import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { LandingPage } from "./LandingPage";
import { FaqJsonLd } from "@/components/SeoJsonLd";

export const metadata: Metadata = {
  title: {
    absolute: "ExpenseTerminal — Tax deductions that sort themselves, for creators & small businesses",
  },
  description:
    "ExpenseTerminal is bookkeeping and tax software for creators, freelancers, and small businesses. Swipe each transaction personal or business and your deductions, budget, and IRS Schedule C build themselves — with automatic quarterly tax set-aside.",
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
              "ExpenseTerminal is bookkeeping and tax software for creators, freelancers, and small businesses. You sort each transaction as personal, business, or a percentage split with a quick swipe, and that single tag builds both your monthly budget and your IRS Schedule C, so you never do tax bookkeeping twice.",
          },
          {
            question: "Who is it for?",
            answer:
              "Creators, freelancers, contractors, and small business owners — designers, photographers, coaches, consultants, drivers, sellers, and content creators. If your personal and business spending share the same bank accounts and cards, ExpenseTerminal is built for exactly that mix.",
          },
          {
            question: "Does it calculate my quarterly taxes?",
            answer:
              "Yes. As income and expenses are tagged, ExpenseTerminal maintains a live estimate of self-employment and federal income tax and tells you how much to set aside for each quarter, and emails you before each deadline. These are estimates to guide your set-aside; confirm final figures with your CPA.",
          },
        ]}
      />
      <LandingPage />
    </>
  );
}
