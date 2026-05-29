import type { Metadata } from "next";
import { TaxPageClient } from "./TaxPageClient";

export const metadata: Metadata = {
  title: "Tax",
};

export default function TaxPage() {
  return <TaxPageClient />;
}
