"use client";

const ICON_SX = {
  fontSize: 18,
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'grad' 0, 'opsz' 24",
} as const;

type Props = {
  icon: string;
  label: string;
  children: React.ReactNode;
  alignTop?: boolean;
  /** Built-in transaction fields (not removable org properties) — tooltip only */
  immutable?: boolean;
};

export function NotionStylePropertyRow({ icon, label, children, alignTop = false, immutable = false }: Props) {
  return (
    <div
      title={immutable ? "Built-in transaction field" : undefined}
      className={`group grid grid-cols-[28px_minmax(140px,180px)_1fr] gap-2 rounded-md py-1.5 pl-1 pr-1 -mx-1 hover:bg-bg-secondary/50 ${
        alignTop ? "items-start" : "items-center"
      }`}
    >
      <span
        className="material-symbols-rounded flex h-7 w-7 items-center justify-center text-mono-medium"
        style={ICON_SX}
        aria-hidden
      >
        {icon}
      </span>
      <span className={`min-w-0 truncate text-xs text-mono-medium ${alignTop ? "pt-0.5" : ""}`}>{label}</span>
      <div className={`min-w-0 text-sm text-mono-dark ${alignTop ? "pt-0" : ""}`}>{children}</div>
    </div>
  );
}

/** Subtle pill for select-like values (Notion-style) */
export function NotionValuePill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "sage" | "amber" }) {
  const tones = {
    neutral: "bg-bg-tertiary/45 text-mono-dark",
    sage: "bg-accent-sage/12 text-accent-sage",
    amber: "bg-amber-50 text-amber-800",
  };
  return (
    <span className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
