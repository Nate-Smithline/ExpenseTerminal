"use client";

import { useEffect, useRef, useState } from "react";
import type { Marker } from "./MarkerPill";
import { PartialDial } from "./PartialDial";

interface MarkerEditorProps {
  marker: Marker;
  businessPct: number;
  onSave: (marker: Marker, businessPct: number) => void;
  onClose: () => void;
}

export function MarkerEditor({ marker, businessPct, onSave, onClose }: MarkerEditorProps) {
  const [localMarker, setLocalMarker] = useState<Marker>(marker);
  const [localPct, setLocalPct] = useState(businessPct);
  const popRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") handleDone();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMarker, localPct]);

  function selectMarker(m: Marker) {
    setLocalMarker(m);
    if (m === "Personal") setLocalPct(0);
    if (m === "Business") setLocalPct(100);
    if (m === "Partial" && (localPct === 0 || localPct === 100)) setLocalPct(50);
  }

  function handleDialChange(pct: number) {
    setLocalPct(pct);
    if (pct === 0) setLocalMarker("Personal");
    else if (pct === 100) setLocalMarker("Business");
    else setLocalMarker("Partial");
  }

  function handleDone() {
    onSave(localMarker, localMarker === "Partial" ? localPct : localMarker === "Business" ? 100 : 0);
    onClose();
  }

  return (
    <div className="marker-editor" ref={popRef}>
      <div className="marker-editor__dial">
        <PartialDial
          value={localPct}
          onChange={handleDialChange}
          compact
        />
      </div>

      {/* Footer */}
      <div className="marker-editor__foot">
        <button type="button" className="btn btn--ghost" onClick={onClose} style={{ fontSize: 12.5 }}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary marker-editor__done" onClick={handleDone} style={{ fontSize: 12.5 }}>
          Accept ↵
        </button>
      </div>
    </div>
  );
}
