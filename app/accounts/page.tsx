import type { Metadata } from "next";
import { AccountsPageClient } from "./AccountsPageClient";

export const metadata: Metadata = {
  title: "Accounts",
};

export default function AccountsPage() {
  return <AccountsPageClient />;
}
