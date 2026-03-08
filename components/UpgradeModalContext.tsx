"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { UpgradeModal } from "./UpgradeModal";

type UpgradeModalContextValue = {
  openUpgradeModal: (reason?: string) => void;
};

const UpgradeModalContext = createContext<UpgradeModalContextValue | null>(null);

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openUpgradeModal = useCallback((_reason?: string) => {
    setOpen(true);
  }, []);

  return (
    <UpgradeModalContext.Provider value={{ openUpgradeModal }}>
      {children}
      <UpgradeModal open={open} onClose={() => setOpen(false)} />
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal(): UpgradeModalContextValue {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) {
    return {
      openUpgradeModal: () => {
        window.location.href = "/pricing";
      },
    };
  }
  return ctx;
}
