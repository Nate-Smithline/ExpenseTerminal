import { redirect } from "next/navigation";

/** Bank connections live on the Accounts page. */
export default function ConnectionsSettingsPage() {
  redirect("/accounts");
}
