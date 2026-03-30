"use client";

const VENDORS = [
  {
    name: "FreeTaxUSA",
    scheduleCUpload: true,
    selfEmployedSupport: true,
    cost: "Free federal / ~$15 state",
    notes: "Solid Schedule C support, manual entry after upload",
  },
  {
    name: "Cash App Taxes",
    scheduleCUpload: true,
    selfEmployedSupport: true,
    cost: "Free",
    notes: "Formerly Credit Karma Tax; good SE support",
  },
  {
    name: "TaxAct",
    scheduleCUpload: true,
    selfEmployedSupport: true,
    cost: "Paid (~$65+)",
    notes: "Accepts imported data; strong 1099 handling",
  },
  {
    name: "TurboTax Self-Employed",
    scheduleCUpload: true,
    selfEmployedSupport: true,
    cost: "Paid (~$130+)",
    notes: "Best guided experience; expensive",
  },
  {
    name: "H&R Block Premium",
    scheduleCUpload: true,
    selfEmployedSupport: true,
    cost: "Paid (~$85+)",
    notes: "In-person option available too",
  },
  {
    name: "TaxSlayer Self-Employed",
    scheduleCUpload: true,
    selfEmployedSupport: true,
    cost: "Paid (~$50+)",
    notes: "Partner API available if pursuing integration",
  },
  {
    name: "Drake Tax (via preparer)",
    scheduleCUpload: true,
    selfEmployedSupport: true,
    cost: "Preparer only",
    notes: "Worth noting for users working with a CPA",
  },
];

export function VendorList() {
  return (
    <div className="space-y-4">
      <div>
        <div
          role="heading"
          aria-level={2}
          className="text-xl font-sans font-medium text-mono-dark"
        >
          Platforms That Accept Schedule C Uploads
        </div>
        <p className="text-xs text-mono-medium mt-2 leading-relaxed max-w-2xl">
          These platforms allow you to reference or manually enter your pre-filled Schedule C
          values. Always verify each line on the platform before submitting.
        </p>
      </div>

      {/* Desktop table */}
      <div className="card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cool-stock/30 border-b border-bg-tertiary/20 text-left">
                <th className="px-4 py-3 font-medium text-mono-dark text-xs">Platform</th>
                <th className="px-4 py-3 font-medium text-mono-dark text-xs text-center">
                  Schedule C
                </th>
                <th className="px-4 py-3 font-medium text-mono-dark text-xs text-center">
                  SE Support
                </th>
                <th className="px-4 py-3 font-medium text-mono-dark text-xs">Cost</th>
                <th className="px-4 py-3 font-medium text-mono-dark text-xs">Notes</th>
              </tr>
            </thead>
            <tbody>
              {VENDORS.map((v) => (
                <tr
                  key={v.name}
                  className="border-b border-bg-tertiary/10 last:border-b-0 hover:bg-cool-stock/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-mono-dark text-xs">
                    {v.name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-accent-sage text-xs font-medium">
                      {v.scheduleCUpload ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-accent-sage text-xs font-medium">
                      {v.selfEmployedSupport ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-mono-medium">{v.cost}</td>
                  <td className="px-4 py-3 text-xs text-mono-light">{v.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {VENDORS.map((v) => (
          <div key={v.name} className="card p-4 space-y-2">
            <div className="font-medium text-sm text-mono-dark">{v.name}</div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-mono-medium">
                Schedule C:{" "}
                <span className="text-accent-sage font-medium">
                  {v.scheduleCUpload ? "Yes" : "No"}
                </span>
              </span>
              <span className="text-mono-medium">
                SE:{" "}
                <span className="text-accent-sage font-medium">
                  {v.selfEmployedSupport ? "Yes" : "No"}
                </span>
              </span>
            </div>
            <div className="text-xs text-mono-medium">{v.cost}</div>
            <div className="text-[11px] text-mono-light">{v.notes}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
