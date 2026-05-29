import { redirect } from "next/navigation";

/** Legacy preferences URL → settings billing */
export default function PreferencesBillingPage() {
  redirect("/settings/billing");
}
