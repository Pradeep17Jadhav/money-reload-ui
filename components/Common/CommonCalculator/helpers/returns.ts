import type { Tenure } from "@/types/ConfigTypes";
import { toDecimal } from "@/helpers/numbers";

/**
 * The returns maths, lifted out of `useCalculator` so it can be shared.
 *
 * Every function here was originally a `useCallback` inside a React hook holding `useState`,
 * which made it unreachable from anything that was not a calculator screen. The `/investments`
 * route needs the *same* numbers a calculator quotes — not a second implementation that drifts
 * from it — so the arithmetic moved here and the calculators now call it. One implementation,
 * and a change to a formula changes both places at once.
 */

/** Whole months a tenure represents, with a partial month kept as a fraction. */
export const monthsIn = (tenure: Tenure): number =>
  tenure.years * 12 + tenure.months + tenure.days / 30.4375;

/**
 * Periodic rate from an annual percentage.
 *
 * An annual rate given as a percentage — `7.25` for 7.25% — becomes a decimal, then divides by
 * the number of compoundings a year. Both steps are required: forgetting the first turns 7.25%
 * into 725% and compounds to an absurd figure, which is exactly the bug this function had for a
 * moment. The calculators' original arithmetic was `roi / 400` for quarterly, which is the same
 * thing written out.
 */
const periodicRate = (annualPercent: number, compoundingsPerYear: number): number =>
  annualPercent / 100 / compoundingsPerYear;

/**
 * A monthly rate that compounds the given annual rate twelve times.
 *
 * The effective monthly rate: `(1 + r)^(1/12) - 1`. Used where money arrives monthly, because
 * an instalment made this month earns a full year of the monthly rate by the end and one less
 * period for every month before it.
 */
const monthlyRateFromAnnual = (annualPercent: number): number =>
  Math.pow(1 + annualPercent / 100, 1 / 12) - 1;

export type FixedReturnInput = {
  /** A single amount deposited once. */
  amount: number;
  /** Annual percentage. */
  rate: number;
  tenure: Tenure;
  /** Compoundings per year: 1 yearly, 2 half-yearly, 4 quarterly, 12 monthly. */
  compoundingsPerYear: number;
};

/**
 * A fixed deposit: one amount, compounded at its stated frequency, held to the end.
 *
 * The classic `A = P(1 + r/k)^(kt)` with `t` in years.
 */
export const fixedDepositValue = ({
  amount,
  rate,
  tenure,
  compoundingsPerYear,
}: FixedReturnInput): number => {
  const years = monthsIn(tenure) / 12;

  return Math.round(
    amount * Math.pow(1 + periodicRate(rate, compoundingsPerYear), compoundingsPerYear * years)
  );
};

/** The same shape as a fixed deposit, for any single-amount instrument. */
export const lumpsumValue = (input: FixedReturnInput): number =>
  fixedDepositValue(input);

export type RecurringInput = Omit<FixedReturnInput, "amount"> & {
  /** Deposited every month, for the whole tenure. */
  monthlyAmount: number;
  /**
   * An amount already in the account, growing for the full tenure.
   *
   * A single sum sitting alongside the instalments — the opening balance of an RD, or a
   * lump sum a user already had before starting a SIP.
   */
  initialAmount?: number;
};

/**
 * A recurring deposit: the same amount every month, compounding until the end.
 *
 * Each instalment only earns for the months remaining after it is made, so the sum walks the
 * deposits in order and grows each one by the periods it was actually invested for.
 */
export const recurringDepositValue = ({
  monthlyAmount,
  initialAmount = 0,
  rate,
  tenure,
  compoundingsPerYear,
}: RecurringInput): number => {
  const totalMonths = monthsIn(tenure);
  const ratePerPeriod = periodicRate(rate, compoundingsPerYear);
  let total = 0;

  for (let month = 1; month <= totalMonths; month += 1) {
    const monthsLeft = totalMonths - month + 1;
    const yearsLeft = monthsLeft / 12;

    total +=
      monthlyAmount *
      Math.pow(1 + ratePerPeriod, compoundingsPerYear * yearsLeft);
  }

  return Math.round(total + initialAmount);
};

export type SipInput = {
  monthlyAmount: number;
  /** Annual percentage, compounded monthly. */
  rate: number;
  tenure: Tenure;
  /**
   * Annual percentage by which the instalment rises at every anniversary.
   *
   * Zero for a flat SIP. Carried because a step-up is a materially different investment — the
   * one most people actually run — and it cannot be recovered from the amount and tenure alone.
   */
  stepUpPercent?: number;
  initialAmount?: number;
};

/**
 * A systematic investment plan: a fixed amount every month, compounded monthly.
 *
 * Closed form rather than a month-by-month walk, because a 30-year step-up SIP is 360
 * compounds and this page may hold many of them at once; the loop is only used when the
 * instalment actually changes, because only then is there no single ratio to apply.
 */
export const sipValue = ({
  monthlyAmount,
  initialAmount = 0,
  rate,
  tenure,
  stepUpPercent = 0,
}: SipInput): number => {
  const monthlyRate = monthlyRateFromAnnual(rate);
  const totalMonths = monthsIn(tenure);

  if (totalMonths <= 0) {
    return Math.round(initialAmount);
  }

  /*
   * At a rate of nothing the annuity formula divides by a zero monthly rate and yields NaN.
   * A savings account earns nothing, so the honest answer is simply everything paid in — and
   * NaN in a table cell reads as a broken page rather than as "this earns nothing".
   */
  if (monthlyRate === 0) {
    return Math.round(initialAmount + monthlyAmount * totalMonths);
  }

  let maturity = 0;

  if (stepUpPercent > 0) {
    // Walk it: the instalment rises every twelfth month, so no single ratio applies.
    let current = monthlyAmount;

    for (let month = 1; month <= totalMonths; month += 1) {
      maturity +=
        current * Math.pow(1 + monthlyRate, totalMonths - month + 1);

      if (month % 12 === 0) {
        current *= 1 + stepUpPercent / 100;
      }
    }

    maturity = Math.round(maturity);
  } else {
    maturity = Math.round(
      monthlyAmount *
        ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) *
        (1 + monthlyRate)
    );
  }

  // A lump sum already held compounds for the whole tenure in its own right.
  const initialMaturity = Math.round(
    initialAmount * Math.pow(1 + monthlyRate, totalMonths)
  );

  return maturity + initialMaturity;
};

/** Everything deposited, for any of the above. What the return is measured against. */
export const totalInvested = (input: {
  monthlyAmount: number;
  initialAmount?: number;
  tenure: Tenure;
}): number =>
  (input.initialAmount ?? 0) + input.monthlyAmount * monthsIn(input.tenure);

export type ReturnsSummary = {
  /** Everything paid in. */
  invested: number;
  /** Worth now — at maturity for a closed instrument, valued today for an open one. */
  currentValue: number;
  /** `currentValue - invested`. Negative when the instrument is behind. */
  profit: number;
  /** `currentValue / invested`, to two decimals. */
  timesMultiplied: number;
};

/** Assembles the three figures every investment shows, from its two inputs. */
export const summariseReturns = (
  invested: number,
  currentValue: number
): ReturnsSummary => ({
  invested,
  currentValue,
  profit: currentValue - invested,
  // Guarded: an investment of nothing has no multiple, and dividing would give NaN into a
  // table cell rather than an honest answer.
  timesMultiplied: invested > 0 ? toDecimal(currentValue / invested) : 0,
});