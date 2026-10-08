import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { buildAmortisation } from "@/components/Common/LoanCalculator/helpers/amortisation";
import { resolveOverride } from "@/components/Common/LoanCalculator/helpers/amortisation";
import { toCalculationDraft } from "@/components/Common/LoanCalculator/helpers/calculationPayload";
import { expandPrepayments } from "@/hooks/Loan/usePrepayments";
import { toPaise } from "@/components/Common/LoanCalculator/helpers/calculationPayload";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";

/**
 * A saved scenario read as a set of figures for one particular month.
 *
 * Money is **integer paise**, matching the `Loan` record, so a resolved loan can be summed
 * with a stored one without either side being converted first.
 */
export type LoanProjection = {
  /** First instalment month of the schedule. */
  startMonth: Dayjs;
  /**
   * The month the schedule actually ends on.
   *
   * Not the nominal end: prepayments close a loan early, and the month the balance reaches
   * zero is the last row of the schedule.
   */
  endMonth: Dayjs;
  /** The month every figure below was read for. */
  activeMonth: Dayjs;
  /** Zero-based position of `activeMonth` in the schedule. */
  activeMonthIndex: number;
  /**
   * The most the lender ever advanced: the sanctioned amount plus every additional
   * disbursement. A loan with a top-up is worth more than the figure it was sanctioned at,
   * and reporting the sanction alone would understate it.
   */
  principal: number;
  /** Annual percentage in force at `activeMonth`. */
  interestRate: number;
  /** Instalment in force at `activeMonth`, in paise. */
  emi: number;
  /** Whole months from `startMonth` to `endMonth`, inclusive. */
  tenureMonths: number;
  /** Every row of the schedule, for callers that need the month-by-month detail. */
  monthlyRows: ReturnType<typeof buildAmortisation>["monthlyRows"];
};

/**
 * Reads a saved scenario at the current month.
 *
 * The "current month" is clamped into the schedule at both ends, because neither extreme has
 * a month of its own: a loan that has not started yet is read at its first month, and one
 * that has already closed is read at the month it closed in. Reporting a rate from before
 * the loan existed, or an instalment for a month that was never paid, would be a figure for
 * no real month.
 */
export const projectLoanCalculation = (
  calculation: SavedLoanCalculation,
  today: Dayjs = dayjs()
): LoanProjection | null => {
  const built = buildSchedule(calculation);

  if (built === null) {
    return null;
  }

  // How many whole months the schedule has run for, which is the position today occupies.
  // Measured from the start month *to* today: before the loan began this is negative, and
  // past the end it exceeds the schedule, which the clamp below absorbs.
  const monthsElapsed = today
    .startOf("month")
    .diff(built.startMonth, "month");
  const activeMonthIndex = Math.min(
    Math.max(monthsElapsed, 0),
    built.monthlyRows.length - 1
  );

  return summarise(built.schedule, built.draft, activeMonthIndex);
};

/**
 * Reads a saved scenario at one specific month, with no clamping.
 *
 * The counterpart to {@link projectLoanCalculation}, for callers that name the month rather
 * than asking "what is in force now" — an expense dated March 2025, chiefly. Clamping is
 * right for a loan's own figures, which describe *today's* position and have to answer even
 * for a loan that has not started. It is wrong here: an expense dated before its loan began,
 * or after the balance reached zero, has no instalment for that month, and returning the
 * nearest month's would invent one.
 *
 * Returns `null` for a month the schedule never had.
 */
export const projectLoanCalculationMonth = (
  calculation: SavedLoanCalculation,
  month: Dayjs
): LoanProjection | null => {
  const built = buildSchedule(calculation);

  if (built === null) {
    return null;
  }

  const index = month.startOf("month").diff(built.startMonth, "month");

  if (index < 0 || index >= built.monthlyRows.length) {
    return null;
  }

  return summarise(built.schedule, built.draft, index);
};

/** Builds the schedule once, for the two readers above to share. */
const buildSchedule = (calculation: SavedLoanCalculation) => {
  const draft = toCalculationDraft(calculation);
  const tenureMonths = draft.tenure.years * 12 + draft.tenure.months;

  if (tenureMonths <= 0 || draft.loanAmount <= 0) {
    return null;
  }

  const prepaymentsByMonth = expandPrepayments({
    prepayments: draft.prepayments,
    tenure: draft.tenure,
    startMonth: draft.startMonth,
  });

  const schedule = buildAmortisation({
    loanAmount: draft.loanAmount,
    rateOfInterest: Number(draft.roi) || 0,
    tenureMonths,
    baseDate: draft.startMonth,
    prepaymentsByMonth,
    overrides: draft.overrides,
  });

  if (schedule.monthlyRows.length === 0) {
    return null;
  }

  return {
    draft,
    schedule,
    startMonth: draft.startMonth,
    // Flattened out so both readers can ask for the row count without reaching through.
    monthlyRows: schedule.monthlyRows,
  };
};

/**
 * Reads one month's figures off a built schedule.
 *
 * Split out because "the current month, clamped" and "the month you asked for" must produce
 * identical figures when they are the same month — otherwise a loan's own EMI and the EMI an
 * expense is charged for the same month could drift apart.
 */
const summarise = (
  schedule: ReturnType<typeof buildAmortisation>,
  draft: ReturnType<typeof toCalculationDraft>,
  activeMonthIndex: number
): LoanProjection => {
  const { monthlyRows } = schedule;
  const startMonth = draft.startMonth;

  // The same lookup the schedule itself uses, so "the rate in force this month" cannot mean
  // two different things in two places.
  const change = resolveOverride(draft.overrides, activeMonthIndex);

  const totalDisbursed = monthlyRows.reduce(
    (sum, row) => sum + row.disbursements,
    0
  );

  return {
    startMonth,
    endMonth: startMonth.add(monthlyRows.length - 1, "month"),
    activeMonth: startMonth.add(activeMonthIndex, "month"),
    activeMonthIndex,
    principal: toPaise(draft.loanAmount + totalDisbursed),
    interestRate: change?.roi ?? Number(draft.roi) ?? 0,
    emi: toPaise(change?.emi ?? schedule.baseEmi),
    tenureMonths: monthlyRows.length,
    monthlyRows,
  };
};
