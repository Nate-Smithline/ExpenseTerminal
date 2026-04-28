import { redirect } from "next/navigation";

export default function TransactionsPage() {
  // Temporary: legacy has the review workflow under `/inbox`.
  redirect("/inbox");
}

