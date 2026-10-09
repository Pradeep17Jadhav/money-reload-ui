import type { ListResponse } from "@/types/FinanceTypes";

/**
 * The regime as the API stores it.
 *
 * Uppercase `OLD`/`NEW`, where the calculator's own config spells them `Old`/`New` — that file is
 * display copy read from the site config, and this one is a stored vocabulary. The two live in
 * separate types on purpose so neither has to carry both spellings.
 */
export type IncomeTaxRegime = "OLD" | "NEW";

/**
 * A saved income-tax scenario: the four things the calculator was asked, and nothing it worked
 * out.
 *
 * The tax, the slabs, the rebate and the after-tax income are all reproducible from these plus
 * the site's budget config, so none of them are stored — which is the whole point, since the
 * budgets are config rather than data and a stored tax would go stale the moment one is revised.
 */
/** One line of side income. Annual, in paise, like every other amount on this app. */
export type AdditionalIncomeEntry = {
  source: string;
  amount: number;
};

export type SavedIncomeTaxCalculation = {
  id: string;
  name: string;
  description: string | null;
  /** `YYYY`, e.g. `2026`. */
  assessmentYear: string;
  /** `YYYY-YY`, e.g. `2025-26`. */
  financialYear: string;
  regime: IncomeTaxRegime;
  /** Integer paise, like every other amount in this app. */
  annualIncome: number;
  useStandardDeduction: boolean;
  /**
   * Side incomes, taxed on top of `annualIncome`.
   *
   * Always an array from the API, never absent — a client asking "is there any additional income"
   * should not have to tell an empty list from a missing key.
   */
  additionalIncome: AdditionalIncomeEntry[];
  createdAt: string;
  updatedAt: string;
};

/**
 * The list as it comes back, before anything normalises it.
 *
 * Kept distinct from {@link SavedIncomeTaxCalculation} on purpose: a response written against an
 * older API would carry no `additionalIncome` at all, and typing the raw response as the stricter
 * type would make that a compile error rather than the empty list it actually is. Every consumer
 * reads through {@link withAdditionalIncome}, which is where that becomes an empty array.
 */
export type IncomeTaxCalculationResponse = Omit<
  SavedIncomeTaxCalculation,
  "additionalIncome"
> & {
  additionalIncome?: AdditionalIncomeEntry[] | undefined;
};

/** A response as a scenario, with a missing line list meaning none rather than an error. */
export const withAdditionalIncome = (
  response: IncomeTaxCalculationResponse
): SavedIncomeTaxCalculation => ({
  ...response,
  additionalIncome: response.additionalIncome ?? [],
});

export type IncomeTaxCalculationsList = ListResponse<SavedIncomeTaxCalculation>;

export type CreateIncomeTaxCalculationPayload = {
  name: string;
  description: string | null;
  assessmentYear: string;
  financialYear: string;
  regime: IncomeTaxRegime;
  /** Integer paise. */
  annualIncome: number;
  useStandardDeduction: boolean;
  /** Omitted when there is none, rather than sent as an empty list. */
  additionalIncome?: AdditionalIncomeEntry[];
};

export type CreateIncomeTaxCalculationResponse = {
  calculation: SavedIncomeTaxCalculation;
};

/** The regime the calculator's own config uses, which is not the stored vocabulary. */
export type DisplayRegime = "Old" | "New";

/** Stored to display. */
export const toDisplayRegime = (regime: IncomeTaxRegime): DisplayRegime =>
  regime === "NEW" ? "New" : "Old";

/** Display to stored, for a client that starts from the config. */
export const toStoredRegime = (regime: DisplayRegime): IncomeTaxRegime =>
  regime === "New" ? "NEW" : "OLD";