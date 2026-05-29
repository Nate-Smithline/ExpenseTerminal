"use client";

// Period switcher — prev/next chevron + label
// Used in Budget header (month), Tax header (year)

import { IChevronL, IChevronR } from "./ui/icons";

interface PeriodProps {
  label: string;
  sub?: string;
  onPrev: () => void;
  onNext: () => void;
}

export function Period({ label, sub, onPrev, onNext }: PeriodProps) {
  return (
    <div className="period">
      <button className="period__btn" onClick={onPrev} aria-label="Previous period">
        <IChevronL size={16} />
      </button>
      <div className="period__label">
        {label}
        {sub && <em>{sub}</em>}
      </div>
      <button className="period__btn" onClick={onNext} aria-label="Next period">
        <IChevronR size={16} />
      </button>
    </div>
  );
}
