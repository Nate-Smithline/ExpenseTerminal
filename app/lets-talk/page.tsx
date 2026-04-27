import { Metadata } from "next";
import { LetsTalkClient } from "./LetsTalkClient";

export const metadata: Metadata = {
  title: "Let’s Talk — ExpenseTerminal",
  description:
    "Talk to a member of the ExpenseTerminal team about your workflow, tax deduction automation, and how we can help you stay organized.",
  alternates: {
    canonical: "https://expenseterminal.com/lets-talk",
  },
};

export default function LetsTalkPage() {
  return <LetsTalkClient />;
}

