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
  {
    href: "/deductions/education",
    label: "Education",
    icon: "school",
    description: "Business-related courses and training",
    typeKey: "education" as const,
  },
  {
    href: "/deductions/health-insurance",
    label: "Phone & Internet",
    icon: "wifi",
    description: "Business-use portion of phone and internet bills",
    typeKey: "phone_internet" as const,
  },
  {
    href: "/deductions/mileage",
    label: "Vehicle Expenses",
    icon: "local_gas_station",
    description: "Actual vehicle expenses (gas, repairs, insurance)",
    typeKey: "vehicle_expenses" as const,
  },
] as const;

export const OTHER_DEDUCTIONS_CARD = {
  href: "/other-deductions",
  label: "Other deductions",
  icon: "folder_open",
  description: "Education, phone, vehicle expenses, and more",
} as const;
