import { formatAmount } from "@/helpers/price";

/**
 * All monetary amounts from the API are integers in paise and the currency is
 * INR. 1 rupee = 100 paise, so `150050` is Rs 1,500.50 and `1500` is Rs 15.00.
 *
 * Interest rates are the one exception: they are plain percentages, so `8.75`
 * is 8.75% and must never be divided.
 */

export const PAISE_PER_RUPEE = 100;

/** Rupees are only ever formatted as INR here, whatever the currency selector says. */
const INR_LOCALE = "en-IN";

/** Paise to a display string. Divides by 100; never uses `toFixed` on the raw value. */
export const formatPaise = (paise: number | null | undefined): string => {
  if (paise === null || paise === undefined) {
    return "-";
  }

  return formatAmount(paise / PAISE_PER_RUPEE, INR_LOCALE, "INR", 2, true);
};

/** Paise to a bare rupee number, for charts and sums that format separately. */
export const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;

/**
 * A percentage is not money. Rendered with up to two decimals and a `%`, and
 * deliberately never passed through the paise conversion. Trailing zeros are
 * dropped so a whole rate reads `8%` rather than `8.00%`.
 */
export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;
};

const RUPEE_INPUT_PATTERN = /^\d+(\.\d{1,2})?$/;

export type RupeeParseResult =
  | { ok: true; paise: number }
  | { ok: false; reason: "empty" | "format" };

/**
 * Converts what the user typed in rupees into the integer paise the API wants.
 *
 * Rounded rather than truncated so `1234.56 * 100` does not lose a paise to
 * floating point, and rejects more than two decimals because the server has no
 * fractional paise and would reject the whole request.
 */
export const rupeesToPaise = (input: string): RupeeParseResult => {
  const trimmed = input.trim().replace(/,/g, "");

  if (!trimmed) {
    return { ok: false, reason: "empty" };
  }

  if (!RUPEE_INPUT_PATTERN.test(trimmed)) {
    return { ok: false, reason: "format" };
  }

  return { ok: true, paise: Math.round(Number(trimmed) * PAISE_PER_RUPEE) };
};

type MoneyInputReason = "empty" | "format" | "nonPositive";

export const MONEY_INPUT_ERRORS: Record<MoneyInputReason, string> = {
  empty: "Enter an amount.",
  format: "Use a number with at most two decimal places.",
  nonPositive: "Amount must be greater than zero.",
};

/**
 * Resolves a money field to paise plus a message, or undefined when valid.
 * `allowZero` covers fields such as `currentAmount` and `taxPaid`.
 */
export const validateMoneyInput = (
  input: string,
  { allowZero = false }: { allowZero?: boolean } = {}
): { paise?: number; error?: string } => {
  const parsed = rupeesToPaise(input);

  if (!parsed.ok) {
    return { error: MONEY_INPUT_ERRORS[parsed.reason] };
  }

  if (!allowZero && parsed.paise <= 0) {
    return { error: MONEY_INPUT_ERRORS.nonPositive };
  }

  return { paise: parsed.paise };
};

/**
 * A compact axis label for a chart, so a value in rupees does not render at
 * full length. Still INR, just shortened.
 */
export const formatPaiseCompact = (paise: number): string =>
  formatAmount(paise / PAISE_PER_RUPEE, INR_LOCALE, "INR", 0, false);