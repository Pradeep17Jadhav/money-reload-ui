import dayjs from "dayjs";
import { toCalculationDraft } from "@/components/Common/LoanCalculator/helpers/calculationPayload";
import {
  CalculationPrepaymentInterval,
  CalculationType,
} from "@/types/Loan/CalculationTypes";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";

/**
 * The API's own response, in the shape it sends it — paise, `YYYY-MM` months, and
 * snake-cased interval codes. Built here rather than reused from the request fixtures
 * so the round trip is checked against the wire format, not against whatever the
 * client happens to send.
 */
const calculation = (
  overrides: Partial<SavedLoanCalculation> = {}
): SavedLoanCalculation => ({
  id: "calculation-1",
  name: "HDB plan with top-up",
  description: "Rate hike in year 4.",
  calculationType: CalculationType.HOME,
  currency: "INR",
  loan: {
    // Rs 50,00,000.00
    loanAmount: 500_000_000,
    rateOfInterest: 8.25,
    tenure: { years: 20, months: 0 },
    startMonth: "2026-10",
  },
  prepayments: [
    // Rs 1,00,000.00
    { amount: 10_000_000, startMonth: "2027-04", interval: CalculationPrepaymentInterval.ANNUALLY },
  ],
  monthChanges: [{ monthIndex: 17, emi: 4_500_000, rateOfInterest: 8.25 }],
  createdAt: "2026-10-07T08:13:49.103Z",
  updatedAt: "2026-10-07T08:13:49.103Z",
  ...overrides,
});

describe("restoring a saved calculation", () => {
  it("turns paise back into rupees, so the loan amount is not 100x too large", () => {
    expect(toCalculationDraft(calculation()).loanAmount).toBe(5_000_000);
  });

  it("reads the rate back as the string the rate input holds", () => {
    expect(toCalculationDraft(calculation()).roi).toBe("8.25");
  });

  it("keeps the tenure, adding the day the calculator does not model", () => {
    expect(toCalculationDraft(calculation()).tenure).toEqual({
      years: 20,
      months: 0,
      days: 0,
    });
  });

  it("reads the start month as the first of that month", () => {
    const { startMonth } = toCalculationDraft(calculation());

    expect(startMonth.format("YYYY-MM-DD")).toBe("2026-10-01");
  });

  it("turns each prepayment back into rupees with a real date", () => {
    const { prepayments } = toCalculationDraft(calculation());

    expect(prepayments).toHaveLength(1);
    expect(prepayments[0].amount).toBe(100_000);
    expect(prepayments[0].startDate.format("YYYY-MM-DD")).toBe("2027-04-01");
    expect(prepayments[0].interval).toBe("Annually");
  });

  it("gives restored rows distinct ids, so React can key them", () => {
    const { prepayments } = toCalculationDraft(
      calculation({
        prepayments: [
          { amount: 10_000_000, startMonth: "2027-04", interval: CalculationPrepaymentInterval.ANNUALLY },
          { amount: 5_000_000, startMonth: "2028-01", interval: CalculationPrepaymentInterval.MONTHLY },
        ],
      })
    );

    expect(prepayments[0].id).not.toBe(prepayments[1].id);
  });

  it("translates every interval, including the one that never repeats", () => {
    const intervals = [
      CalculationPrepaymentInterval.ONE_TIME,
      CalculationPrepaymentInterval.MONTHLY,
      CalculationPrepaymentInterval.QUARTERLY,
      CalculationPrepaymentInterval.HALF_ANNUALLY,
      CalculationPrepaymentInterval.ANNUALLY,
    ];

    const { prepayments } = toCalculationDraft(
      calculation({
        prepayments: intervals.map((interval) => ({
          amount: 1000,
          startMonth: "2027-04",
          interval,
        })),
      })
    );

    expect(prepayments.map((entry) => entry.interval)).toEqual([
      "One Time",
      "Monthly",
      "Quarterly",
      "Half Annually",
      "Annually",
    ]);
  });

  it("restores month changes keyed by month index, in rupees", () => {
    const { overrides } = toCalculationDraft(
      calculation({
        monthChanges: [{ monthIndex: 41, emi: 5_000_000, prepayment: 15_000_000 }],
      })
    );

    expect(overrides[41]).toEqual({ emi: 50_000, prepayment: 150_000 });
  });

  it("restores a disbursement under the name the schedule reads it by", () => {
    const { overrides } = toCalculationDraft(
      calculation({ monthChanges: [{ monthIndex: 23, additionalDisbursement: 50_000_000 }] })
    );

    expect(overrides[23]).toEqual({ disbursement: 500_000 });
  });

  it("restores a rate change as the key the schedule reads it by", () => {
    const { overrides } = toCalculationDraft(
      calculation({ monthChanges: [{ monthIndex: 36, rateOfInterest: 7.5 }] })
    );

    expect(overrides[36]).toEqual({ roi: 7.5 });
  });

  it("leaves a field the scenario did not set absent, not zero", () => {
    const { overrides } = toCalculationDraft(
      calculation({ monthChanges: [{ monthIndex: 36, rateOfInterest: 7.5 }] })
    );

    expect(overrides[36]).toEqual({ roi: 7.5 });
    expect(overrides[36].emi).toBeUndefined();
  });

  it("drops a month change that carries nothing, rather than counting it as an edit", () => {
    const { overrides } = toCalculationDraft(
      calculation({
        monthChanges: [
          { monthIndex: 12 },
          { monthIndex: 13, emi: 1000 },
        ],
      })
    );

    expect(overrides[12]).toBeUndefined();
    expect(overrides[13]).toEqual({ emi: 10 });
  });

  it("handles a plain loan, where the API sent neither optional key", () => {
    const draft = toCalculationDraft(
      calculation({ prepayments: undefined, monthChanges: undefined } as Partial<SavedLoanCalculation>)
    );

    expect(draft.prepayments).toEqual([]);
    expect(draft.overrides).toEqual({});
  });

  it("maps the calculator type back, so a saved scenario can describe its own page", () => {
    expect(toCalculationDraft(calculation()).loanCalculatorType).toBe("HOME");
  });

  it("round-trips a scenario back to the same payload it came from", () => {
    const original = calculation({
      monthChanges: [
        { monthIndex: 17, emi: 4_500_000, rateOfInterest: 8.25 },
        { monthIndex: 23, additionalDisbursement: 50_000_000 },
        { monthIndex: 41, emi: 5_000_000, prepayment: 15_000_000, rateOfInterest: 7.5 },
      ],
    });

    const draft = toCalculationDraft(original);

    expect(draft.loanAmount).toBe(5_000_000);
    expect(draft.startMonth.isSame(dayjs("2026-10-01"))).toBe(true);
    expect(draft.overrides[17]).toEqual({ emi: 45_000, roi: 8.25 });
    expect(draft.overrides[23]).toEqual({ disbursement: 500_000 });
    expect(draft.overrides[41]).toEqual({
      emi: 50_000,
      prepayment: 150_000,
      roi: 7.5,
    });
  });
});