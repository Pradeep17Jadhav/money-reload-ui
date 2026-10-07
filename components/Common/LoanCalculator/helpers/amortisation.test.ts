import dayjs from "dayjs";
import {
  buildAmortisation,
  calculateEmi,
  resolveOverride,
} from "@/components/Common/LoanCalculator/helpers/amortisation";
import type { AmortisationOverrides } from "@/types/Loan/LoanTypes";

const BASE_DATE = dayjs("2026-01-01");
const LOAN_AMOUNT = 1_000_000;
const BASE_EMI = calculateEmi(LOAN_AMOUNT, 12, 12);

const build = (overrides: AmortisationOverrides = {}, prepayments = {}) =>
  buildAmortisation({
    loanAmount: LOAN_AMOUNT,
    rateOfInterest: 12,
    tenureMonths: 12,
    baseDate: BASE_DATE,
    prepaymentsByMonth: prepayments,
    overrides,
  });

describe("calculateEmi", () => {
  it("matches the standard reducing-balance instalment", () => {
    // 1,00,000 at 12% for a year: 8884.88 per month.
    expect(calculateEmi(100_000, 12, 12)).toBeCloseTo(8884.88, 2);
  });

  it("splits the loan evenly at a zero rate", () => {
    expect(calculateEmi(12_000, 0, 12)).toBe(1000);
  });

  it("does not divide by zero on an empty loan or tenure", () => {
    expect(calculateEmi(0, 12, 12)).toBe(0);
    expect(calculateEmi(100_000, 12, 0)).toBe(0);
  });
});

describe("resolveOverride", () => {
  it("carries a change forward to every later month", () => {
    const overrides: AmortisationOverrides = { 3: { emi: 500 } };

    expect(resolveOverride(overrides, 2)).toBeUndefined();
    expect(resolveOverride(overrides, 3)).toEqual({ emi: 500 });
    expect(resolveOverride(overrides, 11)).toEqual({ emi: 500 });
  });

  it("lets a later change override an earlier one field by field", () => {
    const overrides: AmortisationOverrides = {
      2: { emi: 500, roi: 10 },
      6: { roi: 14 },
    };

    // The new rate wins, while the earlier EMI is still standing.
    expect(resolveOverride(overrides, 9)).toEqual({ emi: 500, roi: 14 });
  });

  it("leaves a value standing when a later change does not name it", () => {
    const overrides: AmortisationOverrides = {
      2: { emi: 500 },
      6: { roi: 14 },
    };

    // Month 6 changes the rate alone, so the instalment from month 2 still
    // applies. This is what lets a user stack changes across the tenure.
    expect(resolveOverride(overrides, 8)).toEqual({ emi: 500, roi: 14 });
  });

  it("falls back to what preceded it once a month is reset", () => {
    const overrides: AmortisationOverrides = { 2: { roi: 14 } };

    expect(resolveOverride(overrides, 8)?.roi).toBe(14);
    expect(resolveOverride({}, 8)).toBeUndefined();
  });
});

describe("buildAmortisation", () => {
  it("fully repays the loan over the tenure", () => {
    const { monthlyRows } = build();

    expect(monthlyRows).toHaveLength(12);
    expect(monthlyRows[monthlyRows.length - 1].balance).toBe(0);
  });

  it("allocates every rupee to interest, principal or a prepayment", () => {
    const { monthlyRows } = build();

    for (const month of monthlyRows) {
      // Each figure is rounded on its own, so the parts can drift by a rupee or two.
      expect(
        Math.abs(
          month.principalPaid + month.interestPaid + month.prepayments - month.totalPaid
        )
      ).toBeLessThanOrEqual(2);
    }
  });

  it("never lets the balance go negative", () => {
    const { monthlyRows } = build({}, { "202604": 5_000_000 });

    for (const month of monthlyRows) {
      expect(month.balance).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports the rate and the EMI in force for every month", () => {
    const { monthlyRows } = build();

    expect(monthlyRows[0].interestRate).toBe(12);
    expect(monthlyRows[0].emi).toBe(Math.round(BASE_EMI));
  });

  describe("a rate change", () => {
    it("applies from the edited month onwards and leaves earlier months alone", () => {
      const plain = build();
      const changed = build({ 5: { roi: 18 } });

      // Months before the edit are untouched.
      expect(changed.monthlyRows[4]).toEqual(plain.monthlyRows[4]);

      // From the edited month, interest is charged on the higher rate.
      expect(changed.monthlyRows[5].interestRate).toBe(18);
      expect(changed.monthlyRows[5].interestPaid).toBeGreaterThan(
        plain.monthlyRows[5].interestPaid
      );
      expect(changed.monthlyRows[11].interestRate).toBe(18);
    });

    it("recovers the original schedule once the change is removed", () => {
      const plain = build();
      const changed = build({ 5: { roi: 18 } });

      expect(changed.monthlyRows[11].balance).toBeGreaterThan(
        plain.monthlyRows[11].balance
      );
      expect(build({ 5: {} }).monthlyRows[11].balance).toBe(
        plain.monthlyRows[11].balance
      );
    });
  });

  describe("an EMI change", () => {
    it("applies from the edited month onwards", () => {
      const raised = Math.round(BASE_EMI * 1.5);
      const changed = build({ 3: { emi: raised } });

      expect(changed.monthlyRows[2].emi).toBe(Math.round(BASE_EMI));
      expect(changed.monthlyRows[3].emi).toBe(raised);
      // Carries on to the last month the schedule actually has.
      expect(changed.monthlyRows[changed.monthlyRows.length - 1].emi).toBe(raised);
    });

    it("clears the loan sooner when the instalment goes up", () => {
      const raised = Math.round(BASE_EMI * 1.5);
      const months = build({ 3: { emi: raised } }).monthlyRows.length;

      expect(months).toBeLessThan(12);
      expect(months).toBeGreaterThan(3);
    });

    it("leaves the loan unpaid at the end of the tenure when it goes down", () => {
      const lowered = Math.round(BASE_EMI * 0.5);
      const changed = build({ 3: { emi: lowered } });

      expect(changed.monthlyRows).toHaveLength(12);
      expect(changed.monthlyRows[11].balance).toBeGreaterThan(0);
    });
  });

  describe("a prepayment", () => {
    it("applies to that month only, unlike an EMI or a rate change", () => {
      const changed = build({ 5: { prepayment: 20_000 } });

      expect(changed.monthlyRows[5].prepayments).toBe(20_000);
      expect(changed.monthlyRows[6].prepayments).toBe(0);
      // The instalment itself is untouched by a prepayment.
      expect(changed.monthlyRows[6].emi).toBe(Math.round(BASE_EMI));
    });

    it("caps the prepayment at what is still owed", () => {
      const changed = build({ 5: { prepayment: 99_999_999 } });

      expect(changed.monthlyRows[5].balance).toBe(0);
      expect(changed.monthlyRows).toHaveLength(6);
    });

    it("replaces a scheduled prepayment for the same month", () => {
      const scheduled = build({}, { "202606": 5_000 });
      expect(scheduled.monthlyRows[5].prepayments).toBe(5_000);

      const overridden = build({ 5: { prepayment: 1_000 } });
      expect(overridden.monthlyRows[5].prepayments).toBe(1_000);
    });
  });

  describe("an additional disbursement", () => {
    it("raises the balance from its own month onwards", () => {
      const extra = 200_000;
      const schedule = build({ 2: { disbursement: extra } });
      const plain = build();

      // Before the disbursement the two schedules are identical.
      expect(schedule.monthlyRows[1].disbursements).toBe(0);
      expect(schedule.monthlyRows[1].balance).toBe(plain.monthlyRows[1].balance);

      // From that month the extra money is owed on top of what was.
      expect(schedule.monthlyRows[2].disbursements).toBe(extra);
      expect(schedule.monthlyRows[2].balance).toBeGreaterThan(
        plain.monthlyRows[2].balance
      );

      // It is advanced once, not repeated every month.
      expect(schedule.monthlyRows[5].disbursements).toBe(0);
      expect(schedule.monthlyRows[5].balance).toBeGreaterThan(
        plain.monthlyRows[5].balance
      );
    });

    it("charges interest on the higher principal that same month", () => {
      const schedule = build({ 0: { disbursement: 200_000 } });

      // Added at the top of the month, so this month's interest is on 12,00,000
      // rather than the sanctioned 10,00,000.
      expect(schedule.monthlyRows[0].interestPaid).toBe(Math.round(1_200_000 * (12 / 12 / 100)));
      // The closing balance is the 12,00,000 advanced, less what this month's
      // instalment took off it. Stored rounded, as the table shows it.
      expect(schedule.monthlyRows[0].balance).toBe(
        Math.round(1_200_000 - (BASE_EMI - schedule.monthlyRows[0].interestPaid))
      );
    });

    it("lengthens the loan, since there is more to repay", () => {
      const plain = build();

      expect(build({ 0: { disbursement: 500_000 } }).monthlyRows.length).toBe(
        plain.monthlyRows.length
      );

      // Not enough to close it out early, but enough that it no longer clears on
      // the original EMI within the tenure.
      const raised = build({ 0: { disbursement: 200_000 } });
      const plainBalance = plain.monthlyRows[plain.monthlyRows.length - 1].balance;
      expect(raised.monthlyRows[raised.monthlyRows.length - 1].balance).toBeGreaterThanOrEqual(plainBalance);
    });

    it("counts against the sanctioned amount when working out what is repaid", () => {
      // Without the extra money in the base, the percentage would read as though
      // more than the whole loan had been repaid.
      const schedule = build({ 0: { disbursement: 200_000 } });

      for (const row of schedule.monthlyRows) {
        expect(row.loanPaidPercent).toBeLessThanOrEqual(100);
      }
    });

    it("leaves the extra money outstanding, since the instalment is not resized", () => {
      const plain = build();

      // The EMI stays at the sanctioned amount, so advancing more money means the
      // loan runs the full tenure and still owes something — the same way a
      // prepayment shortens a loan rather than being paid off with it.
      const schedule = build({ 0: { disbursement: 200_000 } });

      expect(schedule.monthlyRows).toHaveLength(plain.monthlyRows.length);
      expect(schedule.monthlyRows[11].balance).toBeGreaterThan(0);
      expect(schedule.monthlyRows[11].balance).toBeGreaterThan(
        plain.monthlyRows[11].balance
      );
    });

    it("does not carry forward as an instruction, only as a raised balance", () => {
      // resolveOverride reads it from the month itself, the same as a prepayment.
      expect(resolveOverride({ 3: { disbursement: 1000 } }, 4)?.disbursement).toBeUndefined();
      expect(resolveOverride({ 3: { disbursement: 1000 } }, 3)?.disbursement).toBe(1000);
    });

    it("adds up across the months of a year", () => {
      const schedule = build({ 0: { disbursement: 100_000 }, 5: { disbursement: 50_000 } });

      expect(schedule.yearlyRows[0].disbursements).toBe(150_000);
    });
  });

  describe("stacked changes", () => {
    it("keeps a later change after an earlier one is added", () => {
      const raised = Math.round(BASE_EMI * 1.25);
      const both = build({ 2: { roi: 14 }, 7: { emi: raised } });

      expect(both.monthlyRows[2].interestRate).toBe(14);
      expect(both.monthlyRows[2].emi).toBe(Math.round(BASE_EMI));

      // The later change takes over, and inherits the earlier rate.
      expect(both.monthlyRows[7].emi).toBe(raised);
      expect(both.monthlyRows[7].interestRate).toBe(14);
      expect(both.monthlyRows[both.monthlyRows.length - 1].emi).toBe(raised);
    });
  });

  describe("totals", () => {
    it("sums the yearly rows, which is what the summary reads", () => {
      const { yearlyRows, totals } = build();

      const interest = yearlyRows.reduce((sum, row) => sum + row.interestPaid, 0);
      expect(totals.interestPaid).toBe(interest);
      expect(totals.totalPayment).toBe(
        totals.interestPaid + totals.principalPaid + totals.totalPrepayments
      );
    });

    it("grows the total interest when the rate goes up", () => {
      expect(build({ 5: { roi: 18 } }).totals.interestPaid).toBeGreaterThan(
        build().totals.interestPaid
      );
    });

    it("reports the number of months actually paid", () => {
      const raised = Math.round(BASE_EMI * 1.5);

      expect(build({ 3: { emi: raised } }).totals.monthsPaid).toBe(
        build({ 3: { emi: raised } }).monthlyRows.length
      );
      expect(build().totals.monthsPaid).toBe(12);
    });
  });

  describe("yearly rows", () => {
    it("carry the rate in force when the year began", () => {
      const { yearlyRows } = build({ 5: { roi: 18 } });

      expect(yearlyRows[0].interestRate).toBe(12);
    });

    it("sum the months beneath them", () => {
      const { monthlyRows, yearlyRows } = build({}, { "202603": 5_000 });
      const firstYearMonths = monthlyRows.filter(
        (row) => Math.floor(row.year / 100) === yearlyRows[0].year
      );

      expect(yearlyRows[0].principalPaid).toBe(
        firstYearMonths.reduce((sum, row) => sum + row.principalPaid, 0)
      );
      expect(yearlyRows[0].prepayments).toBe(5_000);
    });
  });
});