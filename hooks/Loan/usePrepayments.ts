import { useState, useEffect, useMemo } from "react";
import dayjs, { Dayjs } from "dayjs";
import { Tenure } from "@/types/ConfigTypes";

export type PrepaymentsByMonth = Record<string, number>;
export enum PrepaymentInterval {
  ONE_TIME = "One Time",
  MONTHLY = "Monthly",
  QUARTERLY = "Quarterly",
  HALF_ANNUALLY = "Half Annually",
  ANNUALLY = "Annually",
}

export type Prepayment = {
  id: number;
  startDate: Dayjs;
  amount: number;
  interval: PrepaymentInterval;
};

/** How far apart each interval falls. A one-time prepayment happens once. */
const MONTHS_PER_INTERVAL: Record<PrepaymentInterval, number> = {
  [PrepaymentInterval.ONE_TIME]: 0,
  [PrepaymentInterval.MONTHLY]: 1,
  [PrepaymentInterval.QUARTERLY]: 3,
  [PrepaymentInterval.HALF_ANNUALLY]: 6,
  [PrepaymentInterval.ANNUALLY]: 12,
};

/** How many times a repeating interval can still fire inside this tenure. */
const getRemainingIterations = (
  interval: PrepaymentInterval,
  tenure: Tenure
): number => {
  switch (interval) {
    case PrepaymentInterval.ONE_TIME:
      return 1;
    case PrepaymentInterval.ANNUALLY:
      return tenure.years + 1;
    case PrepaymentInterval.HALF_ANNUALLY:
      return tenure.years * 2 + 2;
    case PrepaymentInterval.QUARTERLY:
      return tenure.years * 4 + 5;
    case PrepaymentInterval.MONTHLY:
      return tenure.years * 12 + tenure.months + 1;
  }
};

/**
 * Spreads each prepayment across the months of the loan.
 *
 * Pure and exported rather than kept inside the hook, because restoring a saved
 * scenario needs to know which months a set of prepayments will land in *before* it
 * installs them — the schedule is built from this, and a restore that guessed would
 * produce a different loan from the one that was saved.
 */
export const expandPrepayments = ({
  prepayments,
  tenure,
  startMonth,
}: {
  prepayments: Prepayment[];
  tenure: Tenure;
  /** The month the loan begins, which is where counting starts. */
  startMonth: Dayjs;
}): PrepaymentsByMonth => {
  const byMonth: PrepaymentsByMonth = {};

  if (!tenure.years && !tenure.months) {
    return byMonth;
  }

  const loanStart = startMonth.startOf("month");
  /*
   * The schedule runs from the start month for exactly the number of
   * instalments in the tenure, so the last month that can carry a prepayment is
   * the month of the final instalment. Counting one month beyond it would put a
   * prepayment in a month the schedule has no row for.
   */
  const loanEnd = loanStart.add(tenure.years * 12 + tenure.months - 1, "month");

  prepayments.forEach(({ startDate, amount, interval }) => {
    const step = MONTHS_PER_INTERVAL[interval];

    let cursor = startDate.startOf("month");

    // A one-time prepay has no interval to advance by, so it is judged purely
    // on whether it lands inside the loan.
    if (step === 0) {
      if (!cursor.isBefore(loanStart) && !cursor.isAfter(loanEnd)) {
        const key = cursor.format("YYYYMM");
        byMonth[key] = (byMonth[key] || 0) + amount;
      }
      return;
    }

    let remainingIterations = getRemainingIterations(interval, tenure);

    /*
     * Occurrences before the loan began are skipped rather than counted, and
     * without consuming the iteration budget: a monthly prepayment that has
     * been running for years still has to cover every month of *this* loan.
     */
    while (cursor.isBefore(loanStart)) {
      cursor = cursor.add(step, "month");
    }

    while (!cursor.isAfter(loanEnd) && remainingIterations > 0) {
      const key = cursor.format("YYYYMM");
      byMonth[key] = (byMonth[key] || 0) + amount;
      remainingIterations -= 1;
      cursor = cursor.add(step, "month");
    }
  });

  return byMonth;
};

/**
 * A stable fingerprint of everything the schedule is built from.
 *
 * Used to tell "the loan changed under this set of month changes" from "these month
 * changes were just installed alongside the loan they describe". Object keys are
 * sorted because two maps built by the same logic can enumerate in different orders,
 * and a fingerprint that flapped on key order would read as a changed loan.
 */
export const getLoanSignature = ({
  loanAmount,
  roi,
  tenure,
  prepaymentsByMonth,
}: {
  loanAmount: number;
  roi: string;
  tenure: Tenure;
  prepaymentsByMonth: PrepaymentsByMonth;
}): string =>
  JSON.stringify([
    loanAmount,
    roi,
    tenure.years,
    tenure.months,
    Object.entries(prepaymentsByMonth).sort(([a], [b]) => a.localeCompare(b)),
  ]);

export const usePrepayment = ({
  prepayments,
  tenure,
  startMonth,
}: {
  prepayments: Prepayment[];
  tenure: Tenure;
  /** The month the loan begins, which is where counting starts. */
  startMonth: Dayjs;
}) => {
  /*
   * Derived rather than stored. It used to be an effect writing to state, which meant
   * the schedule was built from the *previous* loan's prepayments for one render — long
   * enough for a restored scenario to install its month changes and then have them
   * cleared against a prepayment map that had not caught up yet.
   */
  const prepaymentsByMonth = useMemo(
    () => expandPrepayments({ prepayments, tenure, startMonth }),
    [prepayments, startMonth, tenure]
  );

  const hasPrepayments = useMemo(
    () => Object.values(prepaymentsByMonth).some((amount) => amount > 0),
    [prepaymentsByMonth]
  );

  return { prepaymentsByMonth, hasPrepayments };
};