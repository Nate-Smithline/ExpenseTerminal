import { redirect } from "next/navigation";

/** Tax setup (filing status) is under Profile; estimated payments are on the Tax page. */
export default function TaxSettingsPage() {
  redirect("/settings/profile");
}
