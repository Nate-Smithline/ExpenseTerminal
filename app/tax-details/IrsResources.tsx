"use client";

import { useState } from "react";

interface ResourceItem {
  title: string;
  description: string;
  icon: string;
  url?: string;
}

interface ResourceSection {
  category: string;
  items: ResourceItem[];
}

const RESOURCES: ResourceSection[] = [
  {
    category: "IRS Forms & Instructions",
    items: [
      {
        title: "Schedule C (Form 1040)",
        description: "Profit or Loss From Business",
        url: "https://www.irs.gov/forms-pubs/about-schedule-c-form-1040",
        icon: "description",
      },
      {
        title: "Schedule SE (Form 1040)",
        description: "Self-Employment Tax",
        url: "https://www.irs.gov/forms-pubs/about-schedule-se-form-1040",
        icon: "description",
      },
      {
        title: "Form 1120-S",
        description: "U.S. Income Tax Return for an S Corporation",
        url: "https://www.irs.gov/forms-pubs/about-form-1120-s",
        icon: "description",
      },
      {
        title: "Form 1040-ES",
        description: "Estimated Tax for Individuals (Quarterly Payments)",
        url: "https://www.irs.gov/forms-pubs/about-form-1040-es",
        icon: "payments",
      },
    ],
  },
  {
    category: "Filing Deadlines",
    items: [
      {
        title: "Q1 Estimated Payment",
        description: "April 15, 2026 — covers Jan 1 – Mar 31",
        icon: "event",
      },
      {
        title: "Q2 Estimated Payment",
        description: "June 15, 2026 — covers Apr 1 – May 31",
        icon: "event",
      },
      {
        title: "Q3 Estimated Payment",
        description: "September 15, 2026 — covers Jun 1 – Aug 31",
        icon: "event",
      },
      {
        title: "Q4 Estimated Payment",
        description: "January 15, 2027 — covers Sep 1 – Dec 31",
        icon: "event",
      },
      {
        title: "Annual Tax Return",
        description: "April 15, 2027 (or October 15 with extension)",
        icon: "event_upcoming",
      },
    ],
  },
  {
    category: "Filing Guide",
    items: [
      {
        title: "What qualifies as a business expense?",
        description:
          "An expense must be both ordinary (common in your industry) and necessary (helpful and appropriate for your business). Personal expenses are never deductible.",
        icon: "help",
      },
      {
        title: "Record keeping requirements",
        description:
          "Keep receipts, bank statements, and records for at least 3 years (6 years if you underreport income by 25%+). Digital records are acceptable.",
        icon: "folder",
      },
      {
        title: "Home office deduction",
        description:
          "You can use the simplified method ($5/sq ft, max 300 sq ft = $1,500) or the regular method (actual expenses × business use percentage).",
        icon: "home",
      },
      {
        title: "Vehicle expenses",
        description:
          "Choose between the standard mileage rate (70¢/mile for 2026) or actual expenses. You must choose one method in the first year you use the vehicle for business.",
        icon: "directions_car",
      },
      {
        title: "Common audit triggers",
        description:
          "Large meal deductions, home office claims, excessive car expenses, round numbers, and consistent losses over multiple years draw IRS attention.",
        icon: "warning",
      },
    ],
  },
  {
    category: "Helpful Links",
    items: [
      {
        title: "IRS Free File",
        description: "Free tax filing for AGI under $84,000",
        url: "https://www.irs.gov/filing/free-file-do-your-federal-taxes-for-free",
        icon: "open_in_new",
      },
      {
        title: "IRS Where's My Refund",
        description: "Track your federal tax refund status",
        url: "https://www.irs.gov/refunds",
        icon: "open_in_new",
      },
      {
        title: "Publication 535 — Business Expenses",
        description: "Comprehensive guide to deductible business expenses",
        url: "https://www.irs.gov/publications/p535",
        icon: "open_in_new",
      },
      {
        title: "Publication 334 — Small Business Tax Guide",
        description: "Tax guide specifically for small business owners",
        url: "https://www.irs.gov/publications/p334",
        icon: "open_in_new",
      },
    ],
  },
];

export function IrsResources() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="card p-0 overflow-hidden">
      <div className="bg-gradient-to-r from-[#2d3748] via-[#3f5147] to-[#635a43] px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              IRS Resources &amp; Filing Guide
            </h3>
            <p className="text-xs text-white/80 max-w-xl leading-relaxed">
              Curated links and plain‑English notes to help you and your tax professional file with confidence.
            </p>
          </div>
          <span className="material-symbols-rounded text-[26px] text-white/70 mt-0.5 hidden md:inline-flex">
            library_books
          </span>
        </div>
      </div>

      <div className="px-6 py-5 space-y-3 bg-bg-secondary/40">
        {RESOURCES.map((section) => {
          const isOpen = expanded === section.category;
          return (
            <div
              key={section.category}
              className="border border-bg-tertiary/40 rounded-xl overflow-hidden bg-white/80 backdrop-blur-sm"
            >
              <button
                onClick={() => setExpanded(isOpen ? null : section.category)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-bg-secondary/60 transition-colors"
              >
                <span className="text-sm font-medium text-mono-dark tracking-wide">
                  {section.category}
                </span>
                <span className="material-symbols-rounded text-[18px] text-mono-light">
                  {isOpen ? "expand_less" : "expand_more"}
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-2 animate-in">
                  {section.items.map((item) => {
                    const Inner = (
                      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-bg-secondary/70 transition-colors">
                        <span className="material-symbols-rounded text-[20px] text-accent-sage/90 mt-0.5 shrink-0">
                          {item.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-mono-dark">
                            {item.title}
                          </p>
                          <p className="text-xs text-mono-medium mt-0.5 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                        {item.url && (
                          <span className="material-symbols-rounded text-[16px] text-mono-light shrink-0 mt-0.5">
                            open_in_new
                          </span>
                        )}
                      </div>
                    );

                    return item.url ? (
                      <a
                        key={item.title}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {Inner}
                      </a>
                    ) : (
                      <div key={item.title}>{Inner}</div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
