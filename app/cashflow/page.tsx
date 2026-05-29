import type { Metadata } from "next";
import { CashFlowPageClient } from "./CashFlowPageClient";

export const metadata: Metadata = {
  title: "Cash Flow",
};

export default function CashFlowPage() {
  return <CashFlowPageClient />;
}
