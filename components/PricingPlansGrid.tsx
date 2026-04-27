 "use client";

import { getPlanDefinition } from "@/lib/billing/plans";

export function PricingPlansGrid() {
  const trial = getPlanDefinition("free");
  const pro = getPlanDefinition("plus");

  const plans = [
    {
      id: trial.id,
      label: "Trial",
      priceHuman: trial.priceHuman,
      priceInterval: trial.priceInterval,
      description: trial.description,
      highlights: trial.highlights,
      badge: "Start here",
    },
    {
      id: pro.id,
      label: pro.name,
      priceHuman: pro.priceHuman,
      priceInterval: pro.priceInterval,
      description: pro.description,
      highlights: pro.highlights,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {plans.map((plan) => (
        <div
          key={plan.id}
          className="rounded-2xl px-5 py-6 text-sm shadow-sm border border-black/5"
          style={{ background: "#F5F0E8" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-mono-dark">{plan.label}</span>
            {plan.badge && (
              <span className="text-xs uppercase tracking-[0.16em] text-mono-medium">
                {plan.badge}
              </span>
            )}
          </div>
          <p className="text-2xl font-display text-mono-dark mb-1">
            {plan.priceHuman}
            {plan.priceInterval === "year" && (
              <span className="text-xs font-normal text-mono-medium">/year</span>
            )}
          </p>
          <p className="text-sm text-mono-medium mb-3">{plan.description}</p>
          <ul className="text-sm text-mono-medium space-y-1.5">
            {plan.highlights.map((h) => (
              <li key={h}>• {h}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

