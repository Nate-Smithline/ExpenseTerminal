"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const TIP_SLIDES = [
  {
    key: "business-use",
    title: "Did you use it for business?",
    detail:
      "The IRS allows deductions for expenses that are both ordinary (common in your trade) and necessary (helpful for your business). Ask yourself: was this primarily for business, not personal? Mixed-use expenses—like a home office or vehicle—require you to allocate only the business portion. When in doubt, keep notes on the business purpose; they strengthen your position if questions come up.",
  },
  {
    key: "meals",
    title: "Meals: 50% rule (and the travel exception)",
    detail:
      "Generally, business meal deductions are limited to 50% of the cost. So a $100 client lunch is a $50 deduction. The main exception: when you're traveling overnight for business, meals during that trip can be 100% deductible in some situations. Entertainment (e.g. golf, concerts) is no longer deductible; meals with clients or while traveling for work still qualify, subject to the 50% cap. We apply the 50% rule automatically for meal expenses in your transactions.",
  },
  {
    key: "record-keeping",
    title: "Why record-keeping matters",
    detail:
      "The IRS can ask for documentation for at least three years after you file. Good records—receipts, dates, amounts, and a short note on business purpose—support your deductions and make audits less stressful. Round numbers and vague descriptions can attract attention; specific, consistent records help show everything is above board. ExpenseTerminal keeps your transactions and categories in one place so you're ready at tax time.",
  },
  {
    key: "stats",
    title: "By the numbers",
    detail:
      "Roughly 1 in 3 small-business owners say they're unsure they're claiming all the deductions they're entitled to. The most commonly missed areas include home office, vehicle use, and unreimbursed business expenses. On the flip side, the IRS reports that excessive or poorly documented deductions are a leading trigger for audits—so tracking properly isn't just about claiming more, it's about staying compliant. Our calculators help you stay within the rules while capturing what you're allowed.",
  },
  {
    key: "home-vehicle",
    title: "Home office & vehicle",
    detail:
      "Home office: If you use part of your home regularly and exclusively for business, you can deduct a portion of rent, utilities, insurance, and similar costs—either with a simplified per-square-foot method or actual expenses. Vehicle: Business miles at the IRS standard rate (or actual expenses) are deductible; commuting from home to a regular workplace usually isn't. Use our Home Office and Mileage calculators to lock in these deductions with the right documentation.",
    href: "/other-deductions",
    linkLabel: "Set up home office & mileage",
  },
  {
    key: "other",
    title: "Other common deductions",
    detail:
      "Beyond the big buckets, many everyday costs can be deductible when they're ordinary and necessary: business share of phone and internet, continuing education, professional tools and software, and similar expenses. There's no single list—it depends on your trade. Use Other deductions to add and track these so nothing slips through.",
    href: "/other-deductions",
    linkLabel: "Other deductions",
  },
];

export function WhatCanIDeduct() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") {
        if (index >= TIP_SLIDES.length - 1) setOpen(false);
        else setIndex((i) => i + 1);
      }
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const slide = TIP_SLIDES[index];

  return (
    <>
      <div className="border-t border-bg-tertiary/50 pt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2 text-mono-medium hover:text-mono-dark transition-colors"
        >
          <span className="font-display text-[15px] tracking-tight">What can I deduct?</span>
          <span className="material-symbols-rounded text-[18px] text-mono-light group-hover:text-mono-medium transition-colors">
            arrow_forward
          </span>
        </button>
        <p className="text-xs text-mono-light mt-1 max-w-md">
          Quick guidance on expenses, meals, travel, and what the IRS allows.
        </p>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-auto">
          <div
            className="fixed inset-0 bg-mono-dark/30 min-h-full min-w-full"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className="relative z-10 bg-white rounded-xl shadow-lg border border-bg-tertiary/60 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col my-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="what-can-i-deduct-title"
          >
            <div className="sticky top-0 bg-white border-b border-bg-tertiary/60 px-5 py-4 flex items-center justify-between shrink-0">
              <h2 id="what-can-i-deduct-title" className="text-lg font-semibold text-mono-dark">
                What can I deduct?
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-mono-medium hover:bg-bg-secondary transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-rounded text-xl">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <h3 className="font-display text-lg text-mono-dark mb-3">{slide.title}</h3>
              <p className="text-sm text-mono-medium leading-relaxed">{slide.detail}</p>
              {slide.href && (
                <Link
                  href={slide.href}
                  className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-accent-sage hover:underline"
                >
                  {slide.linkLabel}
                  <span className="material-symbols-rounded text-[18px]">arrow_forward</span>
                </Link>
              )}
            </div>

            <div className="shrink-0 border-t border-bg-tertiary/60 px-5 py-4 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                disabled={index === 0}
                className="flex items-center gap-1.5 text-sm font-medium text-mono-dark disabled:opacity-40 disabled:cursor-not-allowed hover:underline"
              >
                <span className="material-symbols-rounded text-[20px]">chevron_left</span>
                Previous
              </button>
              <span className="text-xs text-mono-light tabular-nums">
                {index + 1} of {TIP_SLIDES.length}
              </span>
              {index >= TIP_SLIDES.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-1.5 text-sm font-medium text-mono-dark hover:underline"
                >
                  Finish
                  <span className="material-symbols-rounded text-[20px]">check</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIndex((i) => i + 1)}
                  className="flex items-center gap-1.5 text-sm font-medium text-mono-dark hover:underline"
                >
                  Next
                  <span className="material-symbols-rounded text-[20px]">chevron_right</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
