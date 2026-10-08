import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { toDecimal } from "@/helpers/numbers";
import type {
  AmortisationOverrides,
  AmortisationRow,
  MonthOverride,
} from "@/types/Loan/LoanTypes";
import type { PrepaymentsByMonth } from "@/hooks/Loan/usePrepayments";

export type AmortisationInput = {
  loanAmount: number;
  /** Annual rate as a percentage. */
  rateOfInterest: number;
  tenureMonths: number;
  baseDate: Dayjs;
  prepaymentsByMonth: PrepaymentsByMonth;
  /** Manual changes the user has made, keyed by month index. */
  overrides: AmortisationOverrides;
};

export type AmortisationTotals = {
  interestPaid: number;
  principalPaid: number;
  totalPrepayments: number;
  totalPayment: number;
  timesPaid: number;
  monthsPaid: number;
};

export type AmortisationSchedule = {
  monthlyRows: AmortisationRow[];
  yearlyRows: AmortisationRow[];
  /** The EMI the loan starts with, before any change. */
  baseEmi: number;
  totals: AmortisationTotals;
};

/** The standard reducing-balance instalment for a fresh loan. */
export const calculateEmi = (
  loanAmount: number,
  annualRate: number,
  tenureMonths: number
): number => {
  if (tenureMonths <= 0 || loanAmount <= 0) {
    return 0;
  }

  const monthlyRate = annualRate / 12 / 100;

  if (monthlyRate === 0) {
    return loanAmount / tenureMonths;
  }

  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1)
  );
};

/**
 * The change in force at a given month.
 *
 * An EMI or rate change is a standing instruction, so the most recent one at or
 * before this month wins and a later month inherits it.
 *
 * A prepayment is the exception: it belongs to the month it was entered against
 * and never carries forward, which is why it is read from the month itself rather
 * than merged along with the rest. An additional disbursement is the same — the
 * money is advanced in that one month, and only its effect on the balance persists.
 */
export const resolveOverride = (
  overrides: AmortisationOverrides,
  monthIndex: number
): MonthOverride | undefined => {
  let emi: number | undefined;
  let roi: number | undefined;

  for (let index = 0; index <= monthIndex; index += 1) {
    const change = overrides[index];

    if (!change) {
      continue;
    }

    // Only the fields a change actually names are taken from it, so a later change
    // to one value leaves the others it inherits standing.
    if (Object.prototype.hasOwnProperty.call(change, "emi")) {
      emi = change.emi;
    }
    if (Object.prototype.hasOwnProperty.call(change, "roi")) {
      roi = change.roi;
    }
  }

  const prepayment = overrides[monthIndex]?.prepayment;
  const disbursement = overrides[monthIndex]?.disbursement;

  if (
    emi === undefined &&
    roi === undefined &&
    prepayment === undefined &&
    disbursement === undefined
  ) {
    return undefined;
  }

  return { emi, roi, prepayment, disbursement };
};

const round = (value: number): number => Math.round(value);

/**
 * Builds the schedule. Pure, so the arithmetic can be tested without React.
 *
 * With no overrides this reproduces the original calculation exactly; the changes
 * only add the per-month lookup of the EMI, the rate and the prepayment.
 */
export const buildAmortisation = (
  input: AmortisationInput
): AmortisationSchedule => {
  const {
    loanAmount,
    rateOfInterest,
    tenureMonths,
    baseDate,
    prepaymentsByMonth,
    overrides,
  } = input;

  const baseEmi = calculateEmi(loanAmount, rateOfInterest, tenureMonths);
  const monthlyRows: AmortisationRow[] = [];

  let balance = loanAmount;
  // Extra principal advanced so far. It widens the base the paid-up percentage is
  // measured against, since more money is owed than was originally sanctioned.
  let disbursedToDate = 0;

  for (let index = 0; index < tenureMonths; index += 1) {
    const emiDate = baseDate.add(index, "month");
    const monthYear = Number(emiDate.format("YYYYMM"));

    const override = resolveOverride(overrides, index);
    const emi = override?.emi ?? baseEmi;
    const annualRate = override?.roi ?? rateOfInterest;
    const monthlyRate = annualRate / 12 / 100;

    /*
     * Additional disbursement, added at the top of the month so it raises the
     * principal for this month's interest too — "from this month on", rather than
     * only on the instalments after it.
     */
    const disbursement = Math.max(0, override?.disbursement ?? 0);
    balance += disbursement;
    disbursedToDate += disbursement;

    // A manual prepayment replaces the scheduled one for its month only.
    const availablePrepayment =
      override?.prepayment ?? prepaymentsByMonth[monthYear] ?? 0;

    const interest = balance * monthlyRate;
    const amountCanBeGivenToPrincipal = emi - interest;
    const isBalanceFullyPaid = amountCanBeGivenToPrincipal >= balance;
    const isBalanceFullyPaidWithPrepayment =
      amountCanBeGivenToPrincipal + availablePrepayment >= balance;

    const prepayment = isBalanceFullyPaid
      ? 0
      : isBalanceFullyPaidWithPrepayment
      ? balance - amountCanBeGivenToPrincipal
      : availablePrepayment;

    const principal = isBalanceFullyPaid ? balance : amountCanBeGivenToPrincipal;

    const totalPaid = isBalanceFullyPaid
      ? principal + interest + prepayment
      : emi + prepayment;

    balance -= principal + availablePrepayment;
    if (balance < 0) {
      balance = 0;
    }

    const advanced = loanAmount + disbursedToDate;

    monthlyRows.push({
      monthIndex: index,
      year: monthYear,
      principalPaid: round(principal),
      prepayments: round(prepayment),
      disbursements: round(disbursement),
      interestPaid: round(interest),
      totalPaid: round(totalPaid),
      balance: round(Math.max(0, balance)),
      loanPaidPercent:
        advanced > 0 ? toDecimal(((advanced - balance) / advanced) * 100) : 0,
      interestRate: annualRate,
      emi: round(emi),
    });

    if (balance === 0) {
      break;
    }
  }

  const yearlyRows = buildYearlyRows(monthlyRows);
  const totals = buildTotals(yearlyRows, loanAmount, monthlyRows.length);

  return { monthlyRows, yearlyRows, baseEmi, totals };
};

type YearAccumulator = {
  year: number;
  monthIndex: number;
  principalPaid: number;
  prepayments: number;
  disbursements: number;
  interestPaid: number;
  totalPaid: number;
  balance: number;
  loanPaidPercent: number;
  interestRate: number;
  emi: number;
};

const buildYearlyRows = (
  monthlyRows: AmortisationRow[]
): AmortisationRow[] => {
  const byYear: Record<number, YearAccumulator> = {};

  for (const month of monthlyRows) {
    const year = Math.floor(month.year / 100);

    if (!byYear[year]) {
      byYear[year] = {
        year,
        // The first month of the year, which is what the row stands for.
        monthIndex: month.monthIndex,
        principalPaid: 0,
        prepayments: 0,
        disbursements: 0,
        interestPaid: 0,
        totalPaid: 0,
        balance: 0,
        // Overwritten by each month, so what survives is the year's closing
        // month's percentage. That matches the closing balance below and, unlike
        // recomputing it here, keeps any additional disbursement in the base.
        loanPaidPercent: month.loanPaidPercent,
        interestRate: month.interestRate,
        emi: month.emi,
      };
    }

    const yearEntry = byYear[year];
    yearEntry.principalPaid += month.principalPaid;
    yearEntry.prepayments += month.prepayments;
    yearEntry.disbursements += month.disbursements;
    yearEntry.interestPaid += month.interestPaid;
    yearEntry.totalPaid += month.totalPaid;
    yearEntry.balance = Math.max(0, month.balance);
    yearEntry.loanPaidPercent = month.loanPaidPercent;
  }

  return Object.values(byYear).map((yearEntry) => ({
    monthIndex: yearEntry.monthIndex,
    year: yearEntry.year,
    principalPaid: round(yearEntry.principalPaid),
    prepayments: round(yearEntry.prepayments),
    disbursements: round(yearEntry.disbursements),
    interestPaid: round(yearEntry.interestPaid),
    totalPaid: round(yearEntry.totalPaid),
    balance: round(yearEntry.balance),
    loanPaidPercent: yearEntry.loanPaidPercent,
    // The rate in force when the year began. A year can straddle two rates when a
    // change lands mid-year; the opening rate is the one that identifies it.
    interestRate: yearEntry.interestRate,
    emi: yearEntry.emi,
  }));
};

const buildTotals = (
  yearlyRows: AmortisationRow[],
  loanAmount: number,
  monthsPaid: number
): AmortisationTotals => {
  const summed = yearlyRows.reduce(
    (acc, year) => {
      acc.interestPaid += year.interestPaid;
      acc.principalPaid += year.principalPaid;
      acc.totalPrepayments += year.prepayments;
      return acc;
    },
    { interestPaid: 0, principalPaid: 0, totalPrepayments: 0 }
  );

  const totalPayment =
    summed.interestPaid + summed.principalPaid + summed.totalPrepayments;

  return {
    ...summed,
    totalPayment,
    timesPaid:
      loanAmount > 0 ? toDecimal(totalPayment / loanAmount) : 0,
    monthsPaid,
  };
};