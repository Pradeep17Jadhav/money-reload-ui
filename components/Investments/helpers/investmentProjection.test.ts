import dayjs from "dayjs";
import { projectInvestment } from "@/components/Investments/helpers/investmentProjection";
import {
  fixedDepositValue,
  recurringDepositValue,
  sipValue,
} from "@/components/Common/CommonCalculator/helpers/returns";
import { InvestmentStatus, InvestmentType } from "@/types/FinanceTypes";
import type { Investment } from "@/types/FinanceTypes";

/** A fixed deposit, exactly as the API returns it: inputs only, nothing derived. */
const investment = (overrides: Partial<Investment> = {}): Investment => ({
  id: "inv-1",
  title: "HDFC 5-year FD",
  type: InvestmentType.FD,
  startDate: "2024-01-05",
  // Rs 5,00,000
  amount: 50_000_000,
  monthlyAmount: null,
  rate: 7.25,
  tenureYears: 5,
  tenureMonths: 0,
  tenureDays: 0,
  compoundingsPerYear: 4,
  stepUpPercent: null,
  currentValue: null,
  institution: "HDFC Bank",
  reference: null,
  notes: null,
  status: InvestmentStatus.ACTIVE,
  createdAt: "2024-01-05T00:00:00.000Z",
  updatedAt: "2024-01-05T00:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

const TEN_YEARS = { years: 10, months: 0, days: 0 };

describe("reading an investment", () => {
  it("matches the FD calculator on the same figures", () => {
    /*
     * The whole reason the arithmetic was extracted into shared helpers rather than written
     * again: a holding created here and the same numbers entered in the FD calculator must
     * give the same answer, or one of them is lying.
     */
    const fd = investment({
      amount: 5_000_000,
      rate: 7,
      tenureYears: 10,
      compoundingsPerYear: 4,
    });

    const expected = fixedDepositValue({
      amount: 50_000,
      rate: 7,
      tenure: TEN_YEARS,
      compoundingsPerYear: 4,
    });

    const projection = projectInvestment(fd, dayjs("2035-01-01"));

    expect(projection?.maturityValue).toBe(expected * 100);
  });

  it("defaults compounding to quarterly, as the FD calculator quotes", () => {
    const explicit = projectInvestment(
      investment({ amount: 5_000_000, compoundingsPerYear: 4 }),
      dayjs("2035-01-01")
    );
    const unset = projectInvestment(
      investment({ amount: 5_000_000, compoundingsPerYear: null }),
      dayjs("2035-01-01")
    );

    expect(unset?.maturityValue).toBe(explicit?.maturityValue);
  });

  it("honours a different compounding frequency, because it changes the sum", () => {
    const yearly = projectInvestment(
      investment({ amount: 5_000_000, compoundingsPerYear: 1 }),
      dayjs("2035-01-01")
    );
    const monthly = projectInvestment(
      investment({ amount: 5_000_000, compoundingsPerYear: 12 }),
      dayjs("2035-01-01")
    );

    // The same annual rate split twelve ways and compounded twelve times is not the same
    // money as one split four ways. Compounding more often earns more.
    expect(monthly!.maturityValue).toBeGreaterThan(yearly!.maturityValue);
  });

  it("values a deposit part-way through its term at where it is today", () => {
    const projection = projectInvestment(
      investment({ startDate: "2024-01-05", tenureYears: 10 }),
      dayjs("2026-01-01")
    );

    /*
     * Two years in, so two years of compounding — not the full ten. Crediting it with growth
     * it has not had would make the row disagree with the maturity figure on the same record.
     */
    expect(projection?.currentValue).toBeLessThan(projection!.maturityValue);
    expect(projection?.currentValue).toBeGreaterThan(projection!.invested);
  });

  it("stops compounding a holding that has matured", () => {
    const matured = projectInvestment(
      investment({ startDate: "2020-01-05", tenureYears: 5 }),
      dayjs("2030-01-01")
    );

    expect(matured?.isMatured).toBe(true);
    expect(matured?.currentValue).toBe(matured?.maturityValue);
  });

  it("reads a deposit that has not started at what went in", () => {
    const future = projectInvestment(
      investment({ startDate: "2030-01-05", tenureYears: 5 }),
      dayjs("2026-01-01")
    );

    // Month zero. Not its maturity — that would credit it with five years of growth before
    // a single rupee had been deposited.
    expect(future?.currentValue).toBe(future?.invested);
  });

  describe("recurring holdings", () => {
    it("matches the RD calculator rather than the SIP one", () => {
      /*
       * Deliberately checked against the RD helper and not the SIP one. They are different
       * formulas — four compoundings a year against twelve — so reusing the wrong one would
       * quote a number the RD calculator disagrees with.
       */
      const rd = investment({
        type: InvestmentType.RD,
        amount: null,
        monthlyAmount: 50_000,
        rate: 6.4,
        tenureYears: 5,
      });

      const expected = recurringDepositValue({
        monthlyAmount: 500,
        rate: 6.4,
        tenure: { years: 5, months: 0, days: 0 },
        compoundingsPerYear: 4,
      });

      const projection = projectInvestment(rd, dayjs("2030-01-01"));

      expect(projection?.maturityValue).toBe(expected * 100);
    });

    it("adds up everything deposited over the whole term", () => {
      const sip = investment({
        type: InvestmentType.SIP,
        amount: null,
        monthlyAmount: 1_000_000,
        rate: 12,
        tenureYears: 10,
      });

      const projection = projectInvestment(sip, dayjs("2035-01-01"));

      // 120 monthly instalments of Rs 10,000, which is 10,000 × 120 in paise.
      expect(projection?.invested).toBe(120_000_000);
    });

    it("raises the instalment by the step-up, year on year", () => {
      const flat = projectInvestment(
        investment({
          type: InvestmentType.SIP,
          amount: null,
          monthlyAmount: 1_000_000,
          rate: 12,
          tenureYears: 10,
        }),
        dayjs("2035-01-01")
      );
      const stepped = projectInvestment(
        investment({
          type: InvestmentType.SIP,
          amount: null,
          monthlyAmount: 1_000_000,
          rate: 12,
          tenureYears: 10,
          stepUpPercent: 10,
        }),
        dayjs("2035-01-01")
      );

      // A step-up is a materially different investment, so it cannot be recovered from the
      // amount and tenure alone — which is why it is stored.
      expect(stepped!.invested).toBeGreaterThan(flat!.invested);
      expect(stepped!.maturityValue).toBeGreaterThan(flat!.maturityValue);
    });

    it("matches the SIP calculator for the same figures", () => {
      const sip = investment({
        type: InvestmentType.SIP,
        amount: null,
        monthlyAmount: 50_000,
        rate: 12,
        tenureYears: 10,
      });

      const expected = sipValue({
        monthlyAmount: 500,
        rate: 12,
        tenure: TEN_YEARS,
        stepUpPercent: 0,
      });

      expect(projectInvestment(sip, dayjs("2035-01-01"))?.maturityValue).toBe(
        expected * 100
      );
    });
  });

  describe("market-linked holdings", () => {
    const shares = investment({
      type: InvestmentType.STOCKS,
      amount: 20_000_000,
      rate: null,
      tenureYears: null,
      tenureMonths: null,
      tenureDays: null,
      compoundingsPerYear: null,
      currentValue: 26_500_000,
    });

    it("reports what the user says it is worth", () => {
      const projection = projectInvestment(shares, dayjs("2026-06-01"));

      // Nothing here can read a share price, so the stored figure is the answer — and there is
      // no maturity, because a market has no maturity date.
      expect(projection?.currentValue).toBe(26_500_000);
      expect(projection?.isMarketLinked).toBe(true);
      expect(projection?.maturityMonth).toBeNull();
    });

    it("reports the gap as profit or loss", () => {
      const projection = projectInvestment(shares, dayjs("2026-06-01"));

      expect(projection?.invested).toBe(20_000_000);
      expect(projection?.profit).toBe(6_500_000);

      const down = projectInvestment(
        { ...shares, currentValue: 15_000_000 },
        dayjs("2026-06-01")
      );

      // A loss is a real outcome, not an error, and is reported as a negative figure.
      expect(down?.profit).toBe(-5_000_000);
    });

    it("reports nothing rather than zero when there is no value", () => {
      const noValue = projectInvestment(
        { ...shares, currentValue: null },
        dayjs("2026-06-01")
      );

      // A zero would read as a holding worth nothing, which is a different and wrong claim
      // from one that cannot be valued yet.
      expect(noValue).toBeNull();
    });
  });

  it("reports nothing when a deposit has no amount to work from", () => {
    expect(projectInvestment(investment({ amount: null }), dayjs())).toBeNull();
  });

  it("reports nothing when a fixed deposit has no rate", () => {
    // A rate with no value attached is not a figure this screen could act on either.
    expect(projectInvestment(investment({ rate: null }), dayjs())).toBeNull();
  });

  it("reports the month the term ends", () => {
    expect(
      projectInvestment(
        investment({ startDate: "2024-01-05", tenureYears: 5, tenureMonths: 6 }),
        dayjs("2026-01-01")
      )?.maturityMonth
    ).toBe("2029-07");
  });

  it("reports the day the term ends, not only its month", () => {
    expect(
      projectInvestment(
        investment({ startDate: "2024-01-05", tenureYears: 5, tenureMonths: 6 }),
        dayjs("2026-01-01")
      )?.maturityDate
    ).toBe("2029-07-05");
  });

  it("keeps the day of the month the deposit was opened on", () => {
    /*
     * Anchored to the start of its month instead, every deposit would read as ending on the
     * 1st — including one opened on the 25th, which then looks like it ran 24 days short.
     */
    expect(
      projectInvestment(
        investment({ startDate: "2024-01-25", tenureYears: 1 }),
        dayjs("2026-01-01")
      )?.maturityDate
    ).toBe("2025-01-25");
  });

  it("counts the days of the term too", () => {
    expect(
      projectInvestment(
        investment({
          startDate: "2024-01-05",
          tenureYears: 1,
          tenureMonths: 0,
          tenureDays: 20,
        }),
        dayjs("2026-01-01")
      )?.maturityDate
    ).toBe("2025-01-25");
  });

  it("treats a savings balance as having no term", () => {
    const projection = projectInvestment(
      investment({
        type: InvestmentType.SAVINGS,
        amount: 5_000_000,
        rate: 4,
        tenureYears: null,
        tenureMonths: null,
        tenureDays: null,
      }),
      dayjs("2026-01-01")
    );

    expect(projection?.maturityMonth).toBeNull();
    expect(projection?.maturityDate).toBeNull();
    expect(projection?.isMatured).toBe(false);
  });
});