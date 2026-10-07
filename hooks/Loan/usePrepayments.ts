import { useState, useEffect, useCallback } from "react";
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
  const [prepaymentsByMonth, setPrepaymentsByMonth] =
    useState<PrepaymentsByMonth>({});
  const [hasPrepayments, setHasPrepayments] = useState<boolean>(false);

  const getRemainingIterations = useCallback(
    (interval: PrepaymentInterval) => {
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
    },
    [tenure.months, tenure.years]
  );

  useEffect(() => {
    const newPrepayments: PrepaymentsByMonth = {};

    if (!tenure.years && !tenure.months) {
      setPrepaymentsByMonth(newPrepayments);
      setHasPrepayments(false);
      return;
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
          newPrepayments[key] = (newPrepayments[key] || 0) + amount;
        }
        return;
      }

      let remainingIterations = getRemainingIterations(interval);

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
        newPrepayments[key] = (newPrepayments[key] || 0) + amount;
        remainingIterations -= 1;
        cursor = cursor.add(step, "month");
      }
    });

    setPrepaymentsByMonth(newPrepayments);
    setHasPrepayments(
      Object.values(newPrepayments).some((amount) => amount > 0)
    );
  }, [
    getRemainingIterations,
    prepayments,
    startMonth,
    tenure.months,
    tenure.years,
  ]);

  return { prepaymentsByMonth, hasPrepayments };
};
