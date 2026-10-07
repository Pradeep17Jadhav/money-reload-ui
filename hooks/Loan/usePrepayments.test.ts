import { renderHook } from "@testing-library/react";
import dayjs from "dayjs";
import { usePrepayment, PrepaymentInterval } from "@/hooks/Loan/usePrepayments";
import type { Prepayment } from "@/hooks/Loan/usePrepayments";
import type { Tenure } from "@/types/ConfigTypes";

const tenure: Tenure = { years: 1, months: 0, days: 0 };

const prepayment = (
  startMonth: string,
  interval: PrepaymentInterval,
  amount = 10_000
): Prepayment => ({
  id: 1,
  startDate: dayjs(startMonth),
  amount,
  interval,
});

const run = (prepayments: Prepayment[], startMonth: string) => {
  // Created once: a fresh Dayjs on every render would be a new dependency each
  // time and send the effect round for ever.
  const start = dayjs(startMonth);

  return renderHook(() =>
    usePrepayment({ prepayments, tenure, startMonth: start })
  ).result.current;
};

describe("usePrepayment with a chosen start month", () => {
  it("counts from the start month rather than today", () => {
    // A loan that began in January, with a monthly prepay starting that January.
    const { prepaymentsByMonth, hasPrepayments } = run(
      [prepayment("2026-01-01", PrepaymentInterval.MONTHLY)],
      "2026-01-01"
    );

    expect(hasPrepayments).toBe(true);
    expect(prepaymentsByMonth["202601"]).toBe(10_000);
    // The month after the final instalment is outside the loan.
    expect(prepaymentsByMonth["202701"]).toBeUndefined();
  });

  it("spreads a monthly prepayment across the whole tenure", () => {
    const { prepaymentsByMonth } = run(
      [prepayment("2026-01-01", PrepaymentInterval.MONTHLY)],
      "2026-01-01"
    );

    // One year of monthly prepayments from January.
    expect(Object.keys(prepaymentsByMonth)).toHaveLength(12);
    expect(prepaymentsByMonth["202612"]).toBe(10_000);
    expect(prepaymentsByMonth["202701"]).toBeUndefined();
  });

  it("skips occurrences that fall before the loan begins", () => {
    // A quarterly prepay that started before the loan, counted from its own start.
    const { prepaymentsByMonth } = run(
      [prepayment("2025-07-01", PrepaymentInterval.QUARTERLY)],
      "2026-01-01"
    );

    expect(prepaymentsByMonth["202510"]).toBeUndefined();
    expect(prepaymentsByMonth["202601"]).toBe(10_000);
    expect(prepaymentsByMonth["202604"]).toBe(10_000);
  });

  it("still covers every month of the loan for a long-running prepay", () => {
    // Started years before the loan, monthly. The iteration budget must not be
    // consumed by the occurrences that fall outside the loan.
    const { prepaymentsByMonth } = run(
      [prepayment("2000-01-01", PrepaymentInterval.MONTHLY)],
      "2026-01-01"
    );

    expect(Object.keys(prepaymentsByMonth)).toHaveLength(12);
    expect(prepaymentsByMonth["202601"]).toBe(10_000);
  });

  it("ignores a prepay that ends before the loan begins", () => {
    const { prepaymentsByMonth, hasPrepayments } = run(
      [prepayment("2024-01-01", PrepaymentInterval.ONE_TIME)],
      "2026-01-01"
    );

    expect(prepaymentsByMonth).toEqual({});
    expect(hasPrepayments).toBe(false);
  });

  it("moves every occurrence when the start month moves", () => {
    const earlier = run(
      [prepayment("2026-03-01", PrepaymentInterval.MONTHLY)],
      "2026-01-01"
    );
    const later = run(
      [prepayment("2026-03-01", PrepaymentInterval.MONTHLY)],
      "2026-06-01"
    );

    // The prepay begins in March, so January and February are never counted.
    expect(Object.keys(earlier.prepaymentsByMonth)[0]).toBe("202603");
    // Pushing the loan start past it leaves nothing to count.
    expect(Object.keys(later.prepaymentsByMonth)[0]).toBe("202606");
  });

  it("sums several prepayments falling in the same month", () => {
    const { prepaymentsByMonth } = run(
      [
        { ...prepayment("2026-01-01", PrepaymentInterval.MONTHLY, 5_000), id: 1 },
        { ...prepayment("2026-01-15", PrepaymentInterval.ONE_TIME, 2_000), id: 2 },
      ],
      "2026-01-01"
    );

    expect(prepaymentsByMonth["202601"]).toBe(7_000);
  });

  it("reports no prepayments when the tenure is empty", () => {
    // Built outside the render callback: a fresh array each render would change
    // the effect's dependencies and send it round for ever.
    const list = [prepayment("2026-01-01", PrepaymentInterval.MONTHLY)];
    const emptyTenure: Tenure = { years: 0, months: 0, days: 0 };
    const start = dayjs("2026-01-01");

    const { prepaymentsByMonth, hasPrepayments } = renderHook(() =>
      usePrepayment({ prepayments: list, tenure: emptyTenure, startMonth: start })
    ).result.current;

    expect(prepaymentsByMonth).toEqual({});
    expect(hasPrepayments).toBe(false);
  });
});