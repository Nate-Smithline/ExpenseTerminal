"use client";

export type Marker = "Personal" | "Business" | "Partial" | null;

interface MarkerPillProps {
  marker: Marker;
  businessPct?: number; // only for Partial
  onClick?: () => void;
  className?: string;
}

export function MarkerPill({ marker, businessPct = 50, onClick, className = "" }: MarkerPillProps) {
  const markerClass =
    marker === "Personal" ? "marker--personal"
    : marker === "Business" ? "marker--business"
    : marker === "Partial" ? "marker--partial"
    : "marker--unset";

  const label =
    marker === "Partial" ? `${businessPct}% Business`
    : marker ?? "Tag";

  const Tag = onClick ? "button" : "span";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`marker ${markerClass} ${className}`}
      onClick={onClick}
      style={onClick ? { cursor: "pointer", background: "transparent", border: "none", padding: 0 } : undefined}
    >
      {marker === "Partial" ? (
        <span className="marker__split">
          <span className="marker__split-l" style={{ width: `${100 - businessPct}%` }} />
          <span className="marker__split-r" style={{ width: `${businessPct}%` }} />
        </span>
      ) : (
        <span className="marker__dot" />
      )}
      {label}
    </Tag>
  );
}
