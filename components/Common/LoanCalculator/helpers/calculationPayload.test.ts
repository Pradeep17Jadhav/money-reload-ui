import dayjs from "dayjs";
import {
  buildCalculationPayload,
  getCalculationType,
  toPaise,
} from "@/components/Common/LoanCalculator/helpers/calculationPayload";
import type { CalculationDraft } from "@/components/Common/LoanCalculator/helpers/calculationPayload";
import { PrepaymentInterval } from "@/hooks/Loan/usePrepayments";
import type { Prepayment } from "@/hooks/Loan/usePrepayments";
import { LoanCalculatorType } from "@/types/ConfigTypes";
import { CalculationType } from "@/types/Loan/CalculationTypes";
import type { CreateLoanCalculationPayload } from "@/types/Loan/CalculationTypes";
import type { AmortisationOverrides } from "@/types/Loan/LoanTypes";

const prepayment = (overrides: Partial<Prepayment> = {}): Prepayment => ({
  id: 1,
  amount: 100_000,
  startDate: dayjs("2027-04-01"),
  interval: PrepaymentInterval.ANNUALLY,
  ...overrides,
});

const draft = (overrides: Partial<CalculationDraft> = {}): CalculationDraft => ({
  loanCalculatorType: LoanCalculatorType.HOME,
  currency: "INR",
  loanAmount: 5_000_000,
  roi: "8",
  tenure: { years: 20, months: 0, days: 0 },
  startMonth: dayjs("2026-10-01"),
  prepayments: [prepayment()],
  overrides: {},
  ...overrides,
});

const labels = { name: "HDB plan with top-up", description: "Rate hike in year 4." };

/**
 * Every case below builds a payload for a saveable calculator, so the assertions
 * read the result directly instead of re-checking what the one refusal test
 * already covers.
 */
const buildPayload = (
  overrides: Partial<CalculationDraft> = {}
): CreateLoanCalculationPayload => {
  const payload = buildCalculationPayload(draft(overrides), labels);

  if (payload === null) {
    throw new Error("expected a payload for a saveable calculator");
  }

  return payload;
};

const OVERRIDES: AmortisationOverrides = {
  36: { roi: 8.5 },
  12: { emi: 45_000, prepayment: 75_000, disbursement: 250_000 },
  60: { emi: 46_000 },
};

describe("calculation payload", () => {
  describe("getCalculationType", () => {
    it("maps each saveable calculator to its own type", () => {
      expect(getCalculationType(LoanCalculatorType.HOME)).toBe(CalculationType.HOME);
      expect(getCalculationType(LoanCalculatorType.CAR)).toBe(CalculationType.CAR);
      expect(getCalculationType(LoanCalculatorType.PERSONAL)).toBe(
        CalculationType.PERSONAL
      );
    });

    it("has no type for COMMON, which is an analytics grouping", () => {
      expect(getCalculationType(LoanCalculatorType.COMMON)).toBeNull();
    });
  });

  describe("toPaise", () => {
    it("converts rupees to an integer count of minor units", () => {
      expect(toPaise(5_000_000)).toBe(500_000_000);
      expect(toPaise(41_825.7)).toBe(4_182_570);
    });

    it("never produces a fractional amount the API would reject", () => {
      expect(Number.isInteger(toPaise(1_234.567))).toBe(true);
    });
  });

  it("refuses to build a payload for a calculator with no saveable type", () => {
    expect(
      buildCalculationPayload(
        draft({ loanCalculatorType: LoanCalculatorType.COMMON }),
        labels
      )
    ).toBeNull();
  });

  it("trims the labels the user typed", () => {
    const payload = buildCalculationPayload(draft(), {
      name: "  HDB plan  ",
      description: "  Rate hike.  ",
    });

    expect(payload?.name).toBe("HDB plan");
    expect(payload?.description).toBe("Rate hike.");
  });

  describe("loan", () => {
    it("sends the loan amount in paise and the rate as a percentage", () => {
      const payload = buildPayload();

      expect(payload.loan.loanAmount).toBe(500_000_000);
      expect(payload.loan.rateOfInterest).toBe(8);
    });

    it("sends only the years and months, never a derived total", () => {
      const payload = buildPayload({
        tenure: { years: 18, months: 6, days: 0 },
      });

      expect(payload.loan.tenure).toEqual({ years: 18, months: 6 });
    });

    it("sends the start month as YYYY-MM, with no day to drift", () => {
      expect(buildPayload().loan.startMonth).toBe("2026-10");
    });

    it("reads a half-typed rate rather than sending NaN", () => {
      expect(buildPayload({ roi: "8." }).loan.rateOfInterest).toBe(8);
    });

    it("falls back to zero rather than sending a rate that is not a number", () => {
      expect(buildPayload({ roi: "" }).loan.rateOfInterest).toBe(0);
    });
  });

  describe("prepayments", () => {
    it("sends the amount in paise and the start month as YYYY-MM", () => {
      expect(buildPayload().prepayments).toEqual([
        {
          amount: 10_000_000,
          startMonth: "2027-04",
          interval: "ANNUALLY",
        },
      ]);
    });

    it("translates each interval, including the one that never repeats", () => {
      const intervals = [
        PrepaymentInterval.ONE_TIME,
        PrepaymentInterval.MONTHLY,
        PrepaymentInterval.QUARTERLY,
        PrepaymentInterval.HALF_ANNUALLY,
        PrepaymentInterval.ANNUALLY,
      ];

      const payload = buildPayload({
        prepayments: intervals.map((interval, index) =>
          prepayment({ id: index, interval })
        ),
      });

      expect(payload.prepayments?.map((entry) => entry.interval)).toEqual([
        "ONE_TIME",
        "MONTHLY",
        "QUARTERLY",
        "HALF_ANNUALLY",
        "ANNUALLY",
      ]);
    });

    it("drops a row the user left at zero rather than saving a blank field", () => {
      const payload = buildPayload({
        prepayments: [
          prepayment({ id: 1, amount: 0 }),
          prepayment({ id: 2, amount: 50_000 }),
        ],
      });

      expect(payload.prepayments).toHaveLength(1);
      expect(payload.prepayments?.[0].amount).toBe(5_000_000);
    });

    it("keeps every filled row", () => {
      const payload = buildPayload({
        prepayments: [
          prepayment({ id: 1, amount: 100_000 }),
          prepayment({ id: 2, amount: 250_000 }),
        ],
      });

      expect(payload.prepayments).toHaveLength(2);
    });

    it("omits the key entirely when no prepayment carries an amount", () => {
      const payload = buildPayload({ prepayments: [prepayment({ amount: 0 })] });

      expect("prepayments" in payload).toBe(false);
    });
  });

  describe("month changes", () => {
    const changeAt = (
      payload: CreateLoanCalculationPayload,
      monthIndex: number
    ) => payload.monthChanges?.find((entry) => entry.monthIndex === monthIndex);

    it("renames disbursement, which on its own does not say principal was advanced", () => {
      expect(changeAt(buildPayload({ overrides: OVERRIDES }), 12)).toEqual({
        monthIndex: 12,
        emi: 4_500_000,
        prepayment: 7_500_000,
        additionalDisbursement: 25_000_000,
      });
    });

    it("leaves a field the user did not touch absent, not zero", () => {
      const rateOnly = changeAt(buildPayload({ overrides: OVERRIDES }), 36);

      expect(rateOnly).toEqual({ monthIndex: 36, rateOfInterest: 8.5 });
      expect(rateOnly?.emi).toBeUndefined();
      expect(rateOnly?.prepayment).toBeUndefined();
    });

    it("keeps a rate a percentage while the amounts become paise", () => {
      const rateOnly = changeAt(buildPayload({ overrides: OVERRIDES }), 36);

      expect(rateOnly?.rateOfInterest).toBe(8.5);
      expect(rateOnly?.emi).toBeUndefined();
    });

    it("orders by month so the same scenario always serialises the same way", () => {
      const payload = buildPayload({ overrides: OVERRIDES });

      expect(payload.monthChanges?.map((entry) => entry.monthIndex)).toEqual([
        12, 36, 60,
      ]);
    });

    it("omits the key entirely when no month was edited", () => {
      expect("monthChanges" in buildPayload()).toBe(false);
    });
  });

  it("still saves a plain loan, with neither key on the wire", () => {
    const payload = buildPayload({ prepayments: [prepayment({ amount: 0 })] });

    expect(payload).toEqual({
      name: "HDB plan with top-up",
      description: "Rate hike in year 4.",
      calculationType: CalculationType.HOME,
      currency: "INR",
      loan: {
        loanAmount: 500_000_000,
        rateOfInterest: 8,
        tenure: { years: 20, months: 0 },
        startMonth: "2026-10",
      },
    });
  });
});