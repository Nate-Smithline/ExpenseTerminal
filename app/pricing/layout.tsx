import { LandingHeader } from "@/components/LandingHeader";

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-secondary">
      <LandingHeader />
      <main>{children}</main>
    </div>
  );
}
