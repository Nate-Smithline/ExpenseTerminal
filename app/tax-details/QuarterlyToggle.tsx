"use client";

interface QuarterlyToggleProps {
  value: number | null;
  onChange: (quarter: number | null) => void;
}

const QUARTERS = [
  { value: null, label: "Full Year" },
  { value: 1, label: "Q1", sub: "Jan – Mar" },
  { value: 2, label: "Q2", sub: "Apr – Jun" },
  { value: 3, label: "Q3", sub: "Jul – Sep" },
  { value: 4, label: "Q4", sub: "Oct – Dec" },
];

export function QuarterlyToggle({ value, onChange }: QuarterlyToggleProps) {
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  return (
    <div className="flex items-center gap-2">
      {QUARTERS.map((q) => {
        const isActive = value === q.value;
        const isCurrent = q.value === currentQuarter;
        return (
          <button
            key={q.label}
            onClick={() => onChange(q.value)}
            className={`relative px-3 py-2 text-xs font-medium font-sans border ${
              isActive
                ? "bg-[#F5F0E8] border-[#F5F0E8] text-mono-dark"
                : "bg-white border-[#F0F1F7] text-mono-medium hover:bg-[#F5F0E8]/60"
            }`}
          >
            {q.label}
            {isCurrent && !isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent-terracotta" />
            )}
          </button>
        );
      })}
    </div>
  );
}
