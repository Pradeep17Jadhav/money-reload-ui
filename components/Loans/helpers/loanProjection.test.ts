import dayjs from "dayjs";
import {
  projectLoanCalculation,
  projectLoanCalculationMonth,
} from "@/components/Loans/helpers/loanProjection";
import {
  CalculationPrepaymentInterval,
  CalculationType,
} from "@/types/Loan/CalculationTypes";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";

/**
 * The API's own response shape: paise, `YYYY-MM` months, snake-cased interval codes. Built
 * here rather than reused from a request fixture so the projection is checked against the
 * wire format rather than against whatever the client happens to send.
 */
const calculation = (
  overrides: Partial<SavedLoanCalculation> = {}
): SavedLoanCalculation => ({
  id: "calculation-1",
  name: "HDB plan",
  description: null,
  calculationType: CalculationType.HOME,
  currency: "INR",
  loan: {
    // Rs 50,00,000
    loanAmount: 500_000_000,
    rateOfInterest: 8,
    tenure: { years: 20, months: 0 },
    startMonth: "2024-01",
  },
  prepayments: [],
  monthChanges: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

/**
 * Projects a scenario and throws if it yields nothing.
 *
 * Every case here is one that must project, so the assertions can read the result directly
 * instead of repeating a null check. The two cases that must *not* project call
 * `projectLoanCalculation` themselves, because "returns null" is the assertion.
 */
const project = (overrides: Partial<SavedLoanCalculation> = {}, today = "2024-01-01") => {
  const projection = projectLoanCalculation(calculation(overrides), dayjs(today));

  if (!projection) {
    throw new Error("expected this scenario to project");
  }

  return projection;
};

describe("reading a saved calculation at the current month", () => {
  it("turns paise back into paise for display, without a rounding drift", () => {
    expect(project().principal).toBe(500_000_000);
  });

  it("ends on the last month of the schedule, not a nominal one", () => {
    // Twenty years from January 2024 is December 2043: 240 instalment months, inclusive.
    expect(project().endMonth.format("YYYY-MM")).toBe("2043-12");
  });

  it("reads the rate in force at the current month", () => {
    const withHike = calculation({
      monthChanges: [{ monthIndex: 36, rateOfInterest: 8.5 }],
    });

    // Before the hike, the original rate; after it, the new one.
    expect(project(withHike, "2025-01").interestRate).toBe(8);
    expect(project(withHike, "2027-06").interestRate).toBe(8.5);
  });

  it("carries a rate change forward, because it is a standing instruction", () => {
    const withHike = calculation({
      monthChanges: [{ monthIndex: 12, rateOfInterest: 9 }],
    });

    expect(project(withHike, "2030-01").interestRate).toBe(9);
  });

  it("reads the EMI in force at the current month", () => {
    const withStepUp = calculation({
      monthChanges: [{ monthIndex: 24, emi: 5_000_000 }],
    });

    const before = project(withStepUp, "2024-06");
    const after = project(withStepUp, "2026-06");

    expect(after.emi).toBe(5_000_000);
    expect(after.emi).not.toBe(before.emi);
  });

  it("reads a top-up into the principal, because more was advanced", () => {
    const withTopUp = calculation({
      monthChanges: [{ monthIndex: 12, additionalDisbursement: 20_000_000 }],
    });

    // Rs 50,00,000 sanctioned plus Rs 2,00,000 advanced later.
    expect(project(withTopUp).principal).toBe(520_000_000);
  });

  it("adds up several top-ups", () => {
    const withTopUps = calculation({
      monthChanges: [
        { monthIndex: 12, additionalDisbursement: 20_000_000 },
        { monthIndex: 60, additionalDisbursement: 10_000_000 },
      ],
    });

    expect(project(withTopUps).principal).toBe(530_000_000);
  });

  it("closes early when a prepayment pays the balance off", () => {
    const withPrepayment = calculation({
      prepayments: [
        {
          amount: 400_000_000,
          startMonth: "2024-02",
          interval: CalculationPrepaymentInterval.ONE_TIME,
        },
      ],
    });

    const projection = project(withPrepayment);

    // A single large prepay cannot extend a loan, only shorten it.
    expect(projection.tenureMonths).toBeLessThan(240);
    expect(projection.endMonth.isBefore(dayjs("2043-12"))).toBe(true);
  });

  describe("the current month, clamped into the schedule", () => {
    it("reads a loan that has not started yet at its first month", () => {
      // A scenario starting in 2030, read before 2030 arrives.
      const projection = projectLoanCalculation(
        calculation({
          loan: {
            loanAmount: 500_000_000,
            rateOfInterest: 8,
            tenure: { years: 20, months: 0 },
            startMonth: "2030-01",
          },
        }),
        dayjs("2026-01-01")
      );

      expect(projection?.activeMonth.format("YYYY-MM")).toBe("2030-01");
      expect(projection?.activeMonthIndex).toBe(0);
    });

    it("reads a closed loan at the month it closed in", () => {
      const projection = project({}, "2050-01-01");

      expect(projection?.activeMonthIndex).toBe(239);
      expect(projection?.activeMonth.format("YYYY-MM")).toBe("2043-12");
    });

    it("reads the exact month it is in, rather than rounding to a year", () => {
      // Month 17 of the schedule: eighteen months after January 2024.
      const projection = project({}, "2025-06");

      expect(projection?.activeMonthIndex).toBe(17);
      expect(projection?.activeMonth.format("YYYY-MM")).toBe("2025-06");
    });

    it("clamps a loan that closes early to its last real month", () => {
      const withPrepayment = calculation({
        prepayments: [
          {
            amount: 400_000_000,
            startMonth: "2024-02",
            interval: CalculationPrepaymentInterval.ONE_TIME,
          },
        ],
      });

      const projection = project(withPrepayment, "2050-01-01");

      // Not month 239, which would be a month the loan never had.
      expect(projection?.activeMonthIndex).toBe(
        (projection?.tenureMonths ?? 0) - 1
      );
    });
  });

  describe("reading a specific month, for an expense dated then", () => {
    const at = (month: string) =>
      projectLoanCalculationMonth(calculation(), dayjs(month));

    it("answers for a month inside the schedule", () => {
      const projection = at("2026-06");

      expect(projection?.activeMonth.format("YYYY-MM")).toBe("2026-06");
      expect(projection?.emi).toBeGreaterThan(0);
    });

    it("answers identically to the clamped read when the month is the current one", () => {
      // The two readers must not drift: a loan's own EMI and the EMI an expense is charged
      // for the same month have to be the same number, or the same month would total
      // differently on the loans screen and the expenses screen.
      const current = projectLoanCalculation(calculation(), dayjs("2026-06"));

      expect(at("2026-06")?.emi).toBe(current?.emi);
      expect(at("2026-06")?.interestRate).toBe(current?.interestRate);
    });

    it("refuses a month before the loan began, rather than clamping to the first", () => {
      const future = projectLoanCalculationMonth(
        calculation({
          loan: {
            loanAmount: 500_000_000,
            rateOfInterest: 8,
            tenure: { years: 20, months: 0 },
            startMonth: "2030-01",
          },
        }),
        dayjs("2026-01-01")
      );

      // An expense dated 2026 is not an instalment of a loan that starts in 2030. Returning
      // the first month's figure would be inventing an instalment for a month that had none.
      expect(future).toBeNull();
    });

    it("refuses a month after the loan closed, rather than clamping to the last", () => {
      expect(at("2050-01-01")).toBeNull();
    });

    it("refuses every month of a schedule a prepayment already ended", () => {
      const closedEarly = calculation({
        prepayments: [
          {
            amount: 400_000_000,
            startMonth: "2024-02",
            interval: CalculationPrepaymentInterval.ONE_TIME,
          },
        ],
      });

      const last = projectLoanCalculationMonth(closedEarly, dayjs("2043-12-01"));

      expect(last).toBeNull();
    });

    it("picks up a rate change in force at that month, and not one after it", () => {
      const withHike = calculation({
        monthChanges: [{ monthIndex: 36, rateOfInterest: 8.5 }],
      });

      expect(
        projectLoanCalculationMonth(withHike, dayjs("2025-06-01"))?.interestRate
      ).toBe(8);
      expect(
        projectLoanCalculationMonth(withHike, dayjs("2027-06-01"))?.interestRate
      ).toBe(8.5);
    });

    it("picks up an EMI change in force at that month", () => {
      const withStepUp = calculation({
        monthChanges: [{ monthIndex: 24, emi: 5_000_000 }],
      });

      const before = projectLoanCalculationMonth(withStepUp, dayjs("2024-06-01"));
      const after = projectLoanCalculationMonth(withStepUp, dayjs("2026-06-01"));

      expect(before?.emi).not.toBe(5_000_000);
      expect(after?.emi).toBe(5_000_000);
    });
  });

  it("refuses a scenario with nothing to schedule", () => {
    expect(
      projectLoanCalculation(
        calculation({
          loan: {
            loanAmount: 0,
            rateOfInterest: 8,
            tenure: { years: 20, months: 0 },
            startMonth: "2024-01",
          },
        })
      )
    ).toBeNull();
  });

  it("refuses a zero tenure rather than dividing by zero", () => {
    expect(
      projectLoanCalculation(
        calculation({
          loan: {
            loanAmount: 500_000_000,
            rateOfInterest: 8,
            tenure: { years: 0, months: 0 },
            startMonth: "2024-01",
          },
        })
      )
    ).toBeNull();
  });
});
