import { PricingClient } from "./PricingClient";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolved = searchParams != null ? await searchParams : {};
  const sessionId =
    typeof resolved.session_id === "string" ? resolved.session_id : undefined;
  const checkoutStatus = typeof resolved.checkout === "string" ? resolved.checkout : undefined;

  return (
    <PricingClient
      checkoutSessionId={sessionId}
      checkoutStatus={checkoutStatus}
    />
  );
}
