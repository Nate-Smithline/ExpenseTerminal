"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const [steps, setSteps] = useState<Steps | null>(null);
  const [completing, setCompleting] = useState(false); // true while showing 5/5 before closing
  const [closing, setClosing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const hasLoaded = useRef(false);
  const prevCount = useRef(0);

  const fetchSteps = useCallback(() => {
    fetch("/api/onboarding")
      .then(r => r.json())
      .then(d => {
        const newSteps = d.steps as Steps;
        const newCount = Object.values(newSteps).filter(Boolean).length;

        // Detect the moment the last step is checked while the widget is visible
        if (hasLoaded.current && prevCount.current < TOTAL && newCount >= TOTAL) {
          // Set steps + completing together so the render sees both at once —
          // completing=true prevents the doneCount >= TOTAL early-return from firing
          setSteps(newSteps);
          setCompleting(true);
          setTimeout(() => setClosing(true), 900);  // let ring fill, then start exit
          setTimeout(() => setHidden(true), 2000);  // fully remove after exit
        } else {
          setSteps(newSteps);
        }

        prevCount.current = newCount;
        hasLoaded.current = true;
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch on route change (catches navigating away from /onboarding)
  useEffect(() => { fetchSteps(); }, [pathname, fetchSteps]);

  // Re-fetch immediately when a step is completed on the same page
  useEffect(() => {
    window.addEventListener("onboarding:step-complete", fetchSteps);
    return () => window.removeEventListener("onboarding:step-complete", fetchSteps);
  }, [fetchSteps]);

  if (hidden || !steps) return null;

  const doneCount = Object.values(steps).filter(Boolean).length;

  // Already complete on first load (no transition) — hide immediately
  if (doneCount >= TOTAL && !completing) return null;

  const pct = Math.round((doneCount / TOTAL) * 100);

  return (
    <Link href="/onboarding" className={`gs-widget${closing ? " gs-widget--closing" : ""}`}>
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
