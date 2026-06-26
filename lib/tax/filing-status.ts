export type FilingStatus =
  | "single"
  | "married_filing_jointly"
  | "married_filing_separately"
  | "head_of_household";

export const FILING_STATUS_OPTIONS: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married_filing_jointly", label: "Married filing jointly" },
  { value: "married_filing_separately", label: "Married filing separately" },
  { value: "head_of_household", label: "Head of household" },
];

export const INCOME_BRACKETS: Record<
  FilingStatus,
  Array<{ id: string; label: string; taxRate: number }>
> = {
  single: [
    { id: "single:0-11925", label: "$0 – $11,925 (10%)", taxRate: 0.1 },
    { id: "single:11926-48475", label: "$11,926 – $48,475 (12%)", taxRate: 0.12 },
    { id: "single:48476-103350", label: "$48,476 – $103,350 (22%)", taxRate: 0.22 },
    { id: "single:103351-197300", label: "$103,351 – $197,300 (24%)", taxRate: 0.24 },
    { id: "single:197301-250525", label: "$197,301 – $250,525 (32%)", taxRate: 0.32 },
    { id: "single:250526-626350", label: "$250,526 – $626,350 (35%)", taxRate: 0.35 },
    { id: "single:626351-plus", label: "$626,351+ (37%)", taxRate: 0.37 },
  ],
  married_filing_jointly: [
    { id: "joint:0-23850", label: "$0 – $23,850 (10%)", taxRate: 0.1 },
    { id: "joint:23851-96950", label: "$23,851 – $96,950 (12%)", taxRate: 0.12 },
    { id: "joint:96951-206700", label: "$96,951 – $206,700 (22%)", taxRate: 0.22 },
    { id: "joint:206701-394600", label: "$206,701 – $394,600 (24%)", taxRate: 0.24 },
    { id: "joint:394601-501050", label: "$394,601 – $501,050 (32%)", taxRate: 0.32 },
    { id: "joint:501051-752800", label: "$501,051 – $752,800 (35%)", taxRate: 0.35 },
    { id: "joint:752801-plus", label: "$752,801+ (37%)", taxRate: 0.37 },
  ],
  married_filing_separately: [
    { id: "separate:0-11925", label: "$0 – $11,925 (10%)", taxRate: 0.1 },
    { id: "separate:11926-48475", label: "$11,926 – $48,475 (12%)", taxRate: 0.12 },
    { id: "separate:48476-103350", label: "$48,476 – $103,350 (22%)", taxRate: 0.22 },
    { id: "separate:103351-197300", label: "$103,351 – $197,300 (24%)", taxRate: 0.24 },
    { id: "separate:197301-250525", label: "$197,301 – $250,525 (32%)", taxRate: 0.32 },
    { id: "separate:250526-376400", label: "$250,526 – $376,400 (35%)", taxRate: 0.35 },
    { id: "separate:376401-plus", label: "$376,401+ (37%)", taxRate: 0.37 },
  ],
  head_of_household: [
    { id: "hoh:0-17000", label: "$0 – $17,000 (10%)", taxRate: 0.1 },
    { id: "hoh:17001-64850", label: "$17,001 – $64,850 (12%)", taxRate: 0.12 },
    { id: "hoh:64851-103350", label: "$64,851 – $103,350 (22%)", taxRate: 0.22 },
    { id: "hoh:103351-197300", label: "$103,351 – $197,300 (24%)", taxRate: 0.24 },
    { id: "hoh:197301-250500", label: "$197,301 – $250,500 (32%)", taxRate: 0.32 },
    { id: "hoh:250501-626350", label: "$250,501 – $626,350 (35%)", taxRate: 0.35 },
    { id: "hoh:626351-plus", label: "$626,351+ (37%)", taxRate: 0.37 },
  ],
};

export function parseFilingStatus(value: string | null | undefined): FilingStatus | null {
  if (
    value === "single" ||
    value === "married_filing_jointly" ||
    value === "married_filing_separately" ||
    value === "head_of_household"
  ) return value;
  return null;
}

/** Business entity type for org / Schedule C context */
export const BUSINESS_ENTITY_TYPES = [
  { value: "sole_prop", label: "Sole proprietorship" },
  { value: "llc", label: "LLC (single member)" },
  { value: "llc_multi", label: "LLC (multi member)" },
  { value: "s_corp", label: "S-Corporation" },
  { value: "c_corp", label: "C-Corporation" },
  { value: "partnership", label: "Partnership" },
] as const;

export type BusinessEntityType = (typeof BUSINESS_ENTITY_TYPES)[number]["value"];
