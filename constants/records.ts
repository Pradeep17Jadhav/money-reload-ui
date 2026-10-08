import { humaniseEnumValue } from "@/helpers/dates";
import {
  Destination,
  ExpenseCategory,
  GoalCategory,
  GoalPriority,
  GoalStatus,
  IncomeCategory,
  InstallmentType,
  InterestType,
  LoanStatus,
  LoanType,
  PaymentMode,
  RecurrenceFrequency,
} from "@/types/FinanceTypes";

/**
 * Display labels and select options for the contract's enums. Every value here
 * exists in `types/FinanceTypes.ts`; nothing is invented.
 */

export type SelectOption = { value: string; label: string };

/**
 * Acronyms and abbreviations the generic humaniser would mangle. `upi` would
 * otherwise render as "Upi", and `dd` as "Dd".
 */
const LABEL_OVERRIDES: Record<string, string> = {
  upi: "UPI",
  neft: "NEFT",
  imps: "IMPS",
  dd: "Demand draft",
  nach: "NACH",
};

const labelFor = (value: string): string =>
  LABEL_OVERRIDES[value] ?? humaniseEnumValue(value);

/** Display label for any contract enum value, overrides included. */
export const labelForEnumValue = labelFor;

const optionsFrom = (values: readonly string[]): SelectOption[] =>
  values.map((value) => ({ value, label: labelFor(value) }));

export const LOAN_TYPE_OPTIONS = optionsFrom(Object.values(LoanType));
export const INTEREST_TYPE_OPTIONS = optionsFrom(Object.values(InterestType));
export const LOAN_STATUS_OPTIONS = optionsFrom(Object.values(LoanStatus));
export const INCOME_CATEGORY_OPTIONS = optionsFrom(Object.values(IncomeCategory));
export const EXPENSE_CATEGORY_OPTIONS = optionsFrom(Object.values(ExpenseCategory));
export const INSTALLMENT_TYPE_OPTIONS = optionsFrom(Object.values(InstallmentType));
export const PAYMENT_MODE_OPTIONS = optionsFrom(Object.values(PaymentMode));
export const DESTINATION_OPTIONS = optionsFrom(Object.values(Destination));
export const RECURRENCE_OPTIONS = optionsFrom(Object.values(RecurrenceFrequency));
export const GOAL_CATEGORY_OPTIONS = optionsFrom(Object.values(GoalCategory));
export const GOAL_PRIORITY_OPTIONS = optionsFrom(Object.values(GoalPriority));
export const GOAL_STATUS_OPTIONS = optionsFrom(Object.values(GoalStatus));

/** Status values that read better with tone than with a plain word. */
export const LOAN_STATUS_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  [LoanStatus.ACTIVE]: "success",
  [LoanStatus.CLOSED]: "neutral",
  [LoanStatus.PREPAID]: "warning",
  [LoanStatus.OVERDUE]: "error",
  [LoanStatus.FORECLOSED]: "neutral",
};

export const GOAL_STATUS_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  [GoalStatus.ACTIVE]: "success",
  [GoalStatus.ACHIEVED]: "success",
  [GoalStatus.PAUSED]: "warning",
  [GoalStatus.CANCELLED]: "neutral",
  [GoalStatus.EXPIRED]: "error",
};

export const GOAL_PRIORITY_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  [GoalPriority.CRITICAL]: "error",
  [GoalPriority.HIGH]: "warning",
  [GoalPriority.MEDIUM]: "neutral",
  [GoalPriority.LOW]: "neutral",
};

/** Sort keys accepted per resource. `progressPercent` is deliberately absent. */
export const LOAN_SORTS = [
  "createdAt",
  "updatedAt",
  // Because it is the first column and the thing a user scans a list of loans for, it is worth
  // offering alphabetically. `EXPENSE_SORTS` already sorts by title for the same reason.
  "title",
  "principal",
  "emiAmount",
  "startDate",
  "endDate",
  "interestRate",
] as const;

export const INCOME_SORTS = ["createdAt", "updatedAt", "date", "amount"] as const;
export const EXPENSE_SORTS = ["createdAt", "updatedAt", "date", "amount", "title"] as const;
export const GOAL_SORTS = [
  "createdAt",
  "updatedAt",
  "targetDate",
  "targetAmount",
  "currentAmount",
  "priority",
] as const;

export const sortOptions = (keys: readonly string[]): SelectOption[] =>
  keys.map((key) => ({ value: key, label: labelFor(key) }));

/** `search` is capped at 120 characters by the contract. */
export const SEARCH_MAX_LENGTH = 120;

/** The maximum `limit`; values above it are rejected, not clamped. */
export const MAX_PAGE_LIMIT = 100;