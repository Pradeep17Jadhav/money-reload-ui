import dayjs from "dayjs";
import { projectLoanCalculationMonth } from "@/components/Loans/helpers/loanProjection";
import {
  CalculationPrepaymentInterval,
  CalculationType,
} from "@/types/Loan/CalculationTypes";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";

/**
 * The wire shape the API returns, so these are checked against what a loan's calculation
 * actually looks like rather than against whatever the client happens to send.
 */
const calculation = (
  overrides: Partial<SavedLoanCalculation> = {}
): SavedLoanCalculation => ({
  id: "calc-1",
  name: "Best case",
  description: null,
  calculationType: CalculationType.HOME,
  currency: "INR",
  loan: {
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
 * An expense's amount, the way `useLinkedExpenseFigures` reads it: the loan's calculation,
 * resolved at the month the expense is dated.
 *
 * Stands in for the hook itself, which needs an auth context and two mocked requests. The
 * chain being tested is expense → loan → calculation → schedule, and every link in it is
 * covered by something else; what is asserted here is that editing the calculation changes
 * what the expense is worth, with nothing re-saved in between.
 */
const expenseAmount = (
  saved: SavedLoanCalculation,
  expenseMonth: string
): number | null =>
  projectLoanCalculationMonth(saved, dayjs(expenseMonth))?.emi ?? null;

describe("a linked expense follows the calculation", () => {
  it("reads the instalment at the expense's own month", () => {
    expect(expenseAmount(calculation(), "2026-06-01")).toBeGreaterThan(0);
  });

  it("picks up a change to the EMI, with the expense left untouched", () => {
    const before = expenseAmount(calculation(), "2028-01-01");

    // The user edits the saved calculation: a new EMI from month 48 onwards.
    const edited = calculation({
      monthChanges: [{ monthIndex: 48, emi: 60_000_000 }],
    });
    const after = expenseAmount(edited, "2028-01-01");

    // Nothing was re-saved on the expense. The figure moved because the source moved.
    expect(after).toBe(60_000_000);
    expect(after).not.toBe(before);
  });

  it("keeps the instalment when only the rate changes, as the calculator itself does", () => {
    const before = expenseAmount(calculation(), "2028-06-01");
    const after = expenseAmount(
      calculation({ monthChanges: [{ monthIndex: 0, rateOfInterest: 9.5 }] }),
      "2028-06-01"
    );

    /*
     * Deliberate, and the expense mirrors it rather than second-guessing it: a rate hike
     * raises the interest charged and leaves the instalment alone, so the loan takes longer to
     * close. Re-pricing the instalment here would make an expense disagree with the calculator
     * it came from — and the calculator is the thing the user is about to edit.
     */
    expect(after).toBe(before);
    // The rate itself did move, which is the part that shows up in the loan's own figures.
    expect(
      projectLoanCalculationMonth(
        calculation({ monthChanges: [{ monthIndex: 0, rateOfInterest: 9.5 }] }),
        dayjs("2028-06-01")
      )?.interestRate
    ).toBe(9.5);
  });

  it("picks up a prepayment that shortens the loan", () => {
    const extended = calculation();

    // A large prepayment part-way through, so the balance reaches zero years earlier.
    const prepaid = calculation({
      prepayments: [
        {
          amount: 300_000_000,
          startMonth: "2025-06",
          interval: CalculationPrepaymentInterval.ONE_TIME,
        },
      ],
    });

    // A month that the original twenty-year schedule covers, but the prepaid one does not.
    // The loan ended early, so there was no instalment that month to charge for.
    expect(expenseAmount(extended, "2042-01-01")).toBeGreaterThan(0);
    expect(expenseAmount(prepaid, "2042-01-01")).toBeNull();
  });

  it("has nothing to show for a month the loan never had", () => {
    // Before the loan began, and long after it closed.
    expect(expenseAmount(calculation(), "2023-06-01")).toBeNull();
    expect(expenseAmount(calculation(), "2060-01-01")).toBeNull();
  });

  it("reads a different amount for a different month of the same loan", () => {
    const edited = calculation({
      monthChanges: [{ monthIndex: 36, emi: 60_000_000 }],
    });

    // This is why the expense's own month is stored: one loan, a different instalment either
    // side of a step-up, and each expense must resolve to its own month rather than to today.
    expect(expenseAmount(edited, "2024-06-01")).not.toBe(
      expenseAmount(edited, "2028-06-01")
    );
  });
});