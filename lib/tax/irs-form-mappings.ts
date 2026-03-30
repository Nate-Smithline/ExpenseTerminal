/**
 * IRS PDF form field name mappings for pdf-lib form filling.
 *
 * Field names are extracted from the official IRS fillable PDFs using:
 *   form.getFields().map(f => f.getName())
 *
 * // TODO: Verify all field names against the current-year IRS PDFs
 * (f1040sc.pdf, f1040sse.pdf, f8829.pdf, f4562.pdf). Field names may
 * shift between tax years. Run the extraction script on the actual PDFs
 * before production use.
 */

export interface IRSFieldMapping {
  lineKey: string;
  label: string;
  pdfFieldName: string;
}

// Schedule C (Form 1040) — Profit or Loss From Business
// PDF: f1040sc.pdf
export const SCHEDULE_C_FIELD_MAP: IRSFieldMapping[] = [
  // TODO: Verify field names against current-year f1040sc.pdf
  { lineKey: "1", label: "Gross receipts or sales", pdfFieldName: "topmostSubform[0].Page1[0].f1_07[0]" },
  { lineKey: "4", label: "Cost of goods sold", pdfFieldName: "topmostSubform[0].Page1[0].f1_10[0]" },
  { lineKey: "7", label: "Gross income", pdfFieldName: "topmostSubform[0].Page1[0].f1_13[0]" },
  { lineKey: "8", label: "Advertising", pdfFieldName: "topmostSubform[0].Page1[0].f1_14[0]" },
  { lineKey: "9", label: "Car and truck expenses", pdfFieldName: "topmostSubform[0].Page1[0].f1_15[0]" },
  { lineKey: "10", label: "Commissions and fees", pdfFieldName: "topmostSubform[0].Page1[0].f1_16[0]" },
  { lineKey: "11", label: "Contract labor", pdfFieldName: "topmostSubform[0].Page1[0].f1_17[0]" },
  { lineKey: "13", label: "Depreciation", pdfFieldName: "topmostSubform[0].Page1[0].f1_19[0]" },
  { lineKey: "14", label: "Employee benefit programs", pdfFieldName: "topmostSubform[0].Page1[0].f1_20[0]" },
  { lineKey: "15", label: "Insurance (other than health)", pdfFieldName: "topmostSubform[0].Page1[0].f1_21[0]" },
  { lineKey: "16a", label: "Interest (mortgage)", pdfFieldName: "topmostSubform[0].Page1[0].f1_22[0]" },
  { lineKey: "16b", label: "Interest (other)", pdfFieldName: "topmostSubform[0].Page1[0].f1_23[0]" },
  { lineKey: "17", label: "Legal and professional services", pdfFieldName: "topmostSubform[0].Page1[0].f1_24[0]" },
  { lineKey: "18", label: "Office expense", pdfFieldName: "topmostSubform[0].Page1[0].f1_25[0]" },
  { lineKey: "20a", label: "Rent (vehicles, machinery, equipment)", pdfFieldName: "topmostSubform[0].Page1[0].f1_27[0]" },
  { lineKey: "20b", label: "Rent (other business property)", pdfFieldName: "topmostSubform[0].Page1[0].f1_28[0]" },
  { lineKey: "21", label: "Repairs and maintenance", pdfFieldName: "topmostSubform[0].Page1[0].f1_29[0]" },
  { lineKey: "22", label: "Supplies", pdfFieldName: "topmostSubform[0].Page1[0].f1_30[0]" },
  { lineKey: "23", label: "Taxes and licenses", pdfFieldName: "topmostSubform[0].Page1[0].f1_31[0]" },
  { lineKey: "24a", label: "Travel", pdfFieldName: "topmostSubform[0].Page1[0].f1_32[0]" },
  { lineKey: "24b", label: "Deductible meals", pdfFieldName: "topmostSubform[0].Page1[0].f1_33[0]" },
  { lineKey: "25", label: "Utilities", pdfFieldName: "topmostSubform[0].Page1[0].f1_34[0]" },
  { lineKey: "27", label: "Other expenses", pdfFieldName: "topmostSubform[0].Page1[0].f1_36[0]" },
  { lineKey: "28", label: "Total expenses", pdfFieldName: "topmostSubform[0].Page1[0].f1_37[0]" },
  { lineKey: "29", label: "Tentative profit (or loss)", pdfFieldName: "topmostSubform[0].Page1[0].f1_38[0]" },
  { lineKey: "30", label: "Expenses for business use of home", pdfFieldName: "topmostSubform[0].Page1[0].f1_39[0]" },
  { lineKey: "31", label: "Net profit or (loss)", pdfFieldName: "topmostSubform[0].Page1[0].f1_40[0]" },
];

// Schedule C header / identification fields
export const SCHEDULE_C_HEADER_FIELDS = {
  // TODO: Verify field names against current-year f1040sc.pdf
  businessName: "topmostSubform[0].Page1[0].f1_02[0]",
  ein: "topmostSubform[0].Page1[0].f1_04[0]",
  businessAddress: "topmostSubform[0].Page1[0].f1_05[0]",
  principalBusinessActivity: "topmostSubform[0].Page1[0].f1_01[0]",
};

// Schedule SE (Form 1040) — Self-Employment Tax
// PDF: f1040sse.pdf
export const SCHEDULE_SE_FIELD_MAP: IRSFieldMapping[] = [
  // TODO: Verify field names against current-year f1040sse.pdf
  { lineKey: "se_net_profit", label: "Net farm profit or (loss) / Net profit or (loss)", pdfFieldName: "topmostSubform[0].Page1[0].f1_04[0]" },
  { lineKey: "se_combined", label: "Combined lines (net earnings)", pdfFieldName: "topmostSubform[0].Page1[0].f1_06[0]" },
  { lineKey: "se_92_35", label: "92.35% of line above", pdfFieldName: "topmostSubform[0].Page1[0].f1_07[0]" },
  { lineKey: "se_ss_tax", label: "Social Security tax", pdfFieldName: "topmostSubform[0].Page1[0].f1_10[0]" },
  { lineKey: "se_medicare_tax", label: "Medicare tax", pdfFieldName: "topmostSubform[0].Page1[0].f1_11[0]" },
  { lineKey: "se_total", label: "Self-employment tax", pdfFieldName: "topmostSubform[0].Page1[0].f1_12[0]" },
  { lineKey: "se_deductible_half", label: "Deductible part of SE tax", pdfFieldName: "topmostSubform[0].Page1[0].f1_13[0]" },
];

// Form 8829 — Expenses for Business Use of Your Home
// PDF: f8829.pdf
export const FORM_8829_FIELD_MAP: IRSFieldMapping[] = [
  // TODO: Verify field names against current-year f8829.pdf
  { lineKey: "8829_sqft_business", label: "Area used exclusively for business", pdfFieldName: "topmostSubform[0].Page1[0].f1_03[0]" },
  { lineKey: "8829_sqft_total", label: "Total area of home", pdfFieldName: "topmostSubform[0].Page1[0].f1_04[0]" },
  { lineKey: "8829_pct", label: "Business percentage", pdfFieldName: "topmostSubform[0].Page1[0].f1_05[0]" },
  { lineKey: "8829_deduction", label: "Allowable deduction", pdfFieldName: "topmostSubform[0].Page1[0].f1_42[0]" },
];

// Form 4562 — Depreciation and Amortization (Vehicle section)
// PDF: f4562.pdf
export const FORM_4562_FIELD_MAP: IRSFieldMapping[] = [
  // TODO: Verify field names against current-year f4562.pdf
  // TODO: Vehicle Form 4562 structured data — current mileage/vehicle deductions
  //       lack miles and business % in metadata. These fields may be blank until
  //       the mileage calculator stores structured data.
  { lineKey: "4562_total_miles", label: "Total miles driven", pdfFieldName: "topmostSubform[0].Page2[0].f2_19[0]" },
  { lineKey: "4562_business_miles", label: "Business miles", pdfFieldName: "topmostSubform[0].Page2[0].f2_20[0]" },
  { lineKey: "4562_business_pct", label: "Business use percentage", pdfFieldName: "topmostSubform[0].Page2[0].f2_22[0]" },
  { lineKey: "4562_deduction", label: "Vehicle deduction", pdfFieldName: "topmostSubform[0].Page2[0].f2_25[0]" },
];

export type FormType = "schedule_c" | "schedule_se" | "form_8829" | "form_4562";

export function getFieldMapForForm(formType: FormType): IRSFieldMapping[] {
  switch (formType) {
    case "schedule_c":
      return SCHEDULE_C_FIELD_MAP;
    case "schedule_se":
      return SCHEDULE_SE_FIELD_MAP;
    case "form_8829":
      return FORM_8829_FIELD_MAP;
    case "form_4562":
      return FORM_4562_FIELD_MAP;
  }
}

export const ALL_FORM_TYPES: { type: FormType; label: string; pdfFilename: string }[] = [
  { type: "schedule_c", label: "Schedule C — Profit or Loss From Business", pdfFilename: "f1040sc.pdf" },
  { type: "schedule_se", label: "Schedule SE — Self-Employment Tax", pdfFilename: "f1040sse.pdf" },
  { type: "form_8829", label: "Form 8829 — Business Use of Home", pdfFilename: "f8829.pdf" },
  { type: "form_4562", label: "Form 4562 — Depreciation (Vehicle)", pdfFilename: "f4562.pdf" },
];
