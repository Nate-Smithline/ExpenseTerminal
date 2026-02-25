export const DEDUCTION_TYPE_CARDS = [
  {
    href: "/deductions/home-office",
    label: "Home Office",
    icon: "home_work",
    description: "Simplified or actual expense method",
    typeKey: "home_office" as const,
  },
  {
    href: "/deductions/qbi",
    label: "QBI",
    icon: "summarize",
    description: "Qualified business income deduction",
    typeKey: "qbi" as const,
  },
  {
    href: "/deductions/retirement",
    label: "Retirement",
    icon: "account_balance",
    description: "Solo 401k, SEP-IRA, etc.",
    typeKey: "retirement" as const,
  },
  {
    href: "/deductions/health-insurance",
    label: "Health Insurance",
    icon: "health_and_safety",
    description: "Self-employed health deduction",
    typeKey: "health_insurance" as const,
  },
  {
    href: "/deductions/mileage",
    label: "Mileage",
    icon: "directions_car",
    description: "Business mileage rate",
    typeKey: "mileage" as const,
  },
] as const;

export const OTHER_DEDUCTIONS_CARD = {
  href: "/other-deductions",
  label: "Other deductions",
  icon: "folder_open",
  description: "See other deduction calculators and examples of additional write-offs",
} as const;
