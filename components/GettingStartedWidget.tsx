"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Steps = {
  connect: boolean;
  tag: boolean;
  tax: boolean;
  budget: boolean;
  sub: boolean;
};

const TOTAL = 5;

function Ring({ value, total, size = 36, sw = 4 }: { value: number; total: number; size?: number; sw?: number }) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <div className="onb-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="onb-ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} />
        <circle className="onb-ring__fill" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="onb-ring__label" style={{ fontSize: size * 0.27 }}>{value}/{total}</span>
    </div>
  );
}

export function GettingStartedWidget() {
  const [steps, setSteps] = useState<Steps | null>(null);

  useEffect(() => {
    fetch("/api/onboarding")
      .then(r => r.json())
      .then(d => setSteps(d.steps))
      .catch(() => {});
  }, []);

  if (!steps) return null;

  const doneCount = Object.values(steps).filter(Boolean).length;
  if (doneCount >= TOTAL) return null;

  const pct = Math.round((doneCount / TOTAL) * 100);

  return (
    <Link href="/onboarding" className="gs-widget">
      <div className="gs-widget__top">
        <Ring value={doneCount} total={TOTAL} size={36} sw={4} />
        <div className="gs-widget__txt">
          <div className="t">Getting started</div>
          <div className="d">{doneCount} of {TOTAL} complete</div>
        </div>
      </div>
      <div className="gs-widget__bar">
        <i style={{ width: pct + "%" }} />
      </div>
    </Link>
  );
}
