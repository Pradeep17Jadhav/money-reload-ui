import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import {
  fixedDepositValue,
  monthsIn,
  recurringDepositValue,
  sipValue,
  summariseReturns,
} from "@/components/Common/CommonCalculator/helpers/returns";
import type { ReturnsSummary } from "@/components/Common/CommonCalculator/helpers/returns";
import { InvestmentType } from "@/types/FinanceTypes";
import type { Investment } from "@/types/FinanceTypes";

/** Types funded by a repeated monthly payment rather than one lump sum. */
export const RECURRING_TYPES: InvestmentType[] = [
  InvestmentType.RD,
  InvestmentType.SIP,
  InvestmentType.EPF,
  InvestmentType.NPS,
];

/**
 * Quarterly, for a fixed-return holding that does not say otherwise.
 *
 * What an FD almost always is, and what the FD calculator quotes — so a holding created here
 * and the same figures entered there give the same number.
 */
const DEFAULT_COMPOUNDINGS = 4;

/** Types whose value a rate and a term fully determine. */
export const FIXED_RETURN_TYPES: InvestmentType[] = [
  InvestmentType.FD,
  InvestmentType.RD,
  InvestmentType.SIP,
  InvestmentType.LUMPSUM,
  InvestmentType.PPF,
  InvestmentType.EPF,
  InvestmentType.NPS,
  InvestmentType.SAVINGS,
  InvestmentType.BONDS,
  InvestmentType.NSC,
  InvestmentType.TLW,
];

/** Whether a type's value is worked out from what is stored, or supplied by the user. */
export const isFixedReturn = (type: InvestmentType): boolean =>
  FIXED_RETURN_TYPES.includes(type);

/** Whether a type is funded by instalments. Decides which amount field the form asks for. */
export const isRecurring = (type: InvestmentType): boolean =>
  RECURRING_TYPES.includes(type);

/** Whether a step-up applies. Only a SIP's instalment rises on its own. */
export const supportsStepUp = (type: InvestmentType): boolean =>
  type === InvestmentType.SIP;

/** What one investment is worth, worked out from what it stores. */
export type InvestmentProjection = ReturnsSummary & {
  /** Worth at the end of its term, whether or not that has happened yet. */
  maturityValue: number;
  /** `YYYY-MM`. When the term ends, or null for a holding with no term. */
  maturityMonth: string | null;
  /**
   * `YYYY-MM-DD`. The same moment as {@link maturityMonth}, but to the day.
   *
   * Carried separately because month granularity is enough to decide whether a deposit has
   * matured and not enough to tell the user when it runs out — "ends Jan 2029" leaves the day
   * unsaid, and the day is the part a depositor is given. Measured from the start date itself
   * rather than from the first of its month, so a deposit opened on the 5th reads as ending on
   * the 5th and not as silently moving to the 1st.
   */
  maturityDate: string | null;
  /** True once the term is over. A matured investment still compounds no further. */
  isMatured: boolean;
  /** True for a market-linked holding, where the value is the user's own figure. */
  isMarketLinked: boolean;
};

const tenureOf = (investment: Investment) => ({
  years: investment.tenureYears ?? 0,
  months: investment.tenureMonths ?? 0,
  days: investment.tenureDays ?? 0,
});

/**
 * Everything invested, in the units this app stores: **integer paise**.
 *
 * Only ever reached for a type with a figure to read, so a missing amount cannot quietly turn
 * a projection into a total of zero that looks like a real, worthless investment.
 */
const principalOf = (investment: Investment): number | null => {
  const raw = isRecurring(investment.type)
    ? investment.monthlyAmount
    : investment.amount;

  if (raw === null || raw <= 0) {
    return null;
  }

  /*
   * The helpers work in whole currency units, because that is what a user types and what every
   * calculator quotes. Dividing here and re-multiplying at the end keeps one place doing the
   * conversion, rather than each caller having to remember which unit it is holding.
   */
  return Math.round(raw / 100);
};

/** Everything a recurring holding has paid in, step-up included. */
const recurringInvestedUnits = (
  monthlyAmount: number,
  term: { years: number; months: number; days: number },
  stepUpPercent: number
): number => {
  const totalMonths = monthsIn(term);

  if (stepUpPercent <= 0) {
    return monthlyAmount * totalMonths;
  }

  /*
   * Walked rather than scaled, because the instalment changes every twelfth month and so there
   * is no single multiple of the opening payment to apply. Missing this would understate what
   * a step-up SIP actually cost — the same figures showing a profit that was never there.
   */
  let current = monthlyAmount;
  let total = 0;

  for (let month = 1; month <= totalMonths; month += 1) {
    total += current;

    if (month % 12 === 0) {
      current *= 1 + stepUpPercent / 100;
    }
  }

  return total;
};

/**
 * Reads an investment as it stands today.
 *
 * Returns `null` when there is nothing to work from — a fixed deposit with no amount, or a
 * holding whose figures are incomplete. Callers render that as "cannot be shown" rather than
 * as zero, because a zero is a claim about an investment's worth and a missing figure is not.
 *
 * For a **fixed return** the value is arithmetic: the same helpers the FD, RD, SIP and lumpsum
 * calculators use, so this screen and those screens cannot quote different numbers for the same
 * inputs. An instrument that has not matured is valued at the months elapsed so far, which is
 * what it is actually worth today; one that has is valued at its maturity, since compounding
 * a closed deposit further would be inventing growth it cannot earn.
 *
 * For a **market-linked** holding there is nothing to compute, so the user's `currentValue` is
 * the answer. Profit is then the honest gap between what went in and what it is worth.
 */
export const projectInvestment = (
  investment: Investment,
  today: Dayjs = dayjs()
): InvestmentProjection | null => {
  const principal = principalOf(investment);

  if (principal === null) {
    return null;
  }

  if (!isFixedReturn(investment.type)) {
    const currentValue = investment.currentValue;

    if (currentValue === null) {
      return null;
    }

    const returns = summariseReturns(
      // `principal` came back in whole units from `principalOf`; `currentValue` is the user's
      // own figure and is already paise like everything else on this app.
      Math.round(principal * 100),
      Math.round(currentValue)
    );

    return {
      ...returns,
      // No term and no compounding, so there is no maturity to speak of.
      maturityValue: returns.currentValue,
      maturityMonth: null,
      maturityDate: null,
      isMatured: false,
      isMarketLinked: true,
    };
  }

  const rate = investment.rate;

  if (rate === null) {
    return null;
  }

  const tenure = tenureOf(investment);
  const startMonth = dayjs(investment.startDate).startOf("month");
  const fullTerm = {
    years: tenure.years,
    months: tenure.months,
    // Days only refine a part-month; carried onto months so the helper's own conversion is
    // the single place that decides what a day is worth.
    days: tenure.days,
  };
  const monthlyAmount = isRecurring(investment.type) ? principal : 0;
  const compoundings = investment.compoundingsPerYear ?? DEFAULT_COMPOUNDINGS;

  /*
   * Two different formulas for monthly money, and the difference is real: a SIP compounds a
   * single *monthly* rate, while a deposit compounds the stated frequency over the months each
   * instalment is actually held. Four compoundings a year is not twelve. Using the SIP
   * formula for an RD would quote a different number from the RD calculator for the same
   * inputs, which is precisely what these helpers were extracted to prevent.
   *
   * EPF and NPS sit with the deposits: both are standing monthly contributions to a scheme
   * with a declared rate, not a market-linked instalment plan.
   */
  const valueAt = (term: typeof fullTerm): number => {
    if (!isRecurring(investment.type)) {
      return fixedDepositValue({
        amount: principal,
        rate,
        tenure: term,
        compoundingsPerYear: compoundings,
      });
    }

    if (investment.type === InvestmentType.SIP) {
      return sipValue({
        monthlyAmount,
        rate,
        tenure: term,
        stepUpPercent: investment.stepUpPercent ?? 0,
      });
    }

    return recurringDepositValue({
      monthlyAmount,
      rate,
      tenure: term,
      compoundingsPerYear: compoundings,
    });
  };

  const maturityValue = valueAt(fullTerm);

  const maturityDate = startMonth.add(
    tenure.years * 12 + tenure.months,
    "month"
  );

  /*
   * A holding with no term — a savings balance — has no maturity, and saying it matures the
   * month it was opened would invent an end date the user never mentioned. `isMatured` is
   * still false, so it keeps accruing, which is the whole point of a balance.
   */
  const hasTerm = tenure.years + tenure.months + tenure.days > 0;
  const isMatured =
    hasTerm && !today.startOf("month").isBefore(maturityDate);

  /*
   * What it is worth *now*: the same arithmetic over the part of the term that has elapsed.
   * A holding that has not started yet therefore reads at month zero — it has been worth its
   * own principal, which is true — rather than at its maturity, which would credit it with
   * growth it has not had.
   */
  const elapsedMonths = Math.max(
    0,
    today.startOf("month").diff(startMonth, "month")
  );
  const elapsedTerm = {
    years: Math.floor(elapsedMonths / 12),
    months: elapsedMonths % 12,
    days: 0,
  };

  const currentValueInUnits = isMatured ? maturityValue : valueAt(elapsedTerm);

  const investedUnits = isRecurring(investment.type)
    ? recurringInvestedUnits(
        monthlyAmount,
        fullTerm,
        investment.stepUpPercent ?? 0
      )
    : principal;

  const returns = summariseReturns(
    Math.round(investedUnits * 100),
    Math.round(currentValueInUnits * 100)
  );

  return {
    ...returns,
    maturityValue: Math.round(maturityValue * 100),
    maturityMonth: hasTerm ? maturityDate.format("YYYY-MM") : null,
    /*
     * The real end of the term: the start date plus the whole of it, days included. Deliberately
     * not the `startMonth`-anchored date above, which drops the day of the month to decide
     * maturity at month granularity and would read as every deposit ending on the 1st.
     */
    maturityDate: hasTerm
      ? dayjs(investment.startDate)
          .add(tenure.years * 12 + tenure.months, "month")
          .add(tenure.days, "day")
          .format("YYYY-MM-DD")
      : null,
    isMatured,
    isMarketLinked: false,
  };
};