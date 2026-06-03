import type { Metadata } from "next";
import "../design/triage.css";
import { TriagePageClient } from "./TriagePageClient";

export const metadata: Metadata = {
  title: "Tax Triage",
};

export default function TriagePage() {
  return <TriagePageClient />;
}
