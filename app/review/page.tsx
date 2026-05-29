import type { Metadata } from "next";
import { ReviewPageClient } from "./ReviewPageClient";

export const metadata: Metadata = {
  title: "Review",
};

export default function ReviewPage() {
  return <ReviewPageClient />;
}
