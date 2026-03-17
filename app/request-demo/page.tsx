import { Metadata } from "next";
import { RequestDemoClient } from "./RequestDemoClient";

export const metadata: Metadata = {
  title: "Request a demo of ExpenseTerminal tax deduction software",
  description:
    "Request a personalized demo of ExpenseTerminal to see how AI-powered expense tracking helps you capture more self-employed tax deductions and prepare audit-ready reports.",
  alternates: {
    canonical: "https://expenseterminal.com/request-demo",
  },
};

export default function RequestDemoPage() {
  return <RequestDemoClient />;
}

