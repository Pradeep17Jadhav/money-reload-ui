import { createElement, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { investmentColumns } from "@/components/Investments/InvestmentsConfig";
import { projectInvestment } from "@/components/Investments/helpers/investmentProjection";
import { InvestmentStatus, InvestmentType } from "@/types/FinanceTypes";
import type { Investment, InvestmentType as Type } from "@/types/FinanceTypes";

/**
 * The text a cell renders, which is how a column's output is asserted elsewhere.
 *
 * `createElement` rather than JSX because this suite is a `.ts` file, and renaming it to `.tsx`
 * to suit one helper would be churn.
 */
const renderCell = (node: ReactNode): string => {
  const { container } = render(createElement("div", null, node));

  return container.textContent ?? "";
};

/** A holding as the API returns it. */
const investment = (overrides: Partial<Investment> = {}): Investment => ({
  id: "inv-1",
  title: "HDFC 5-year FD",
  type: InvestmentType.FD,
  startDate: "2024-01-05",
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

/** A projection that answers, so the figure columns have something to render. */
const projectionFor = () => ({
  invested: 50_000_000,
  currentValue: 70_000_000,
  maturityValue: 70_000_000,
  maturityMonth: "2029-01",
  maturityDate: "2029-01-05",
  profit: 20_000_000,
  timesMultiplied: 1.4,
  isMatured: false,
  isMarketLinked: false,
});

const keysFor = (type: Type | null): string[] =>
  investmentColumns(projectionFor, type).map((column) => column.key);

describe("one table per kind of holding", () => {
  it("drops the type column when the table already says which type it is", () => {
    /*
     * Repeating "Fixed deposit" down every row of the fixed-deposit table would be the widest
     * column on the screen saying nothing the tab above it has not already said.
     */
    expect(keysFor(InvestmentType.FD)).not.toContain("type");
    expect(keysFor(null)).toContain("type");
  });

  it("keeps the type column on the table that mixes kinds", () => {
    expect(keysFor(null)).toContain("type");
  });

  describe("a fixed deposit", () => {
    const keys = keysFor(InvestmentType.FD);

    it("shows the rate, which decides what it returns", () => {
      expect(keys).toContain("rate");
    });

    it("shows when it matures", () => {
      expect(keys).toContain("dates");
    });

    it("dates the maturity to the day, not just the month", () => {
      const columns = investmentColumns(projectionFor, InvestmentType.FD);
      const dates = columns.find((column) => column.key === "dates");

      const text = renderCell(dates?.render(investment()));

      // It was "ends Jan 2029", which leaves the day unsaid — and the day is the part a
      // depositor is actually given.
      expect(text).toContain("ends 05 Jan 2029");
      expect(text).not.toMatch(/ends\s+\w{3}\s+2029$/);
    });

    it("has no monthly column, because it is not funded by instalments", () => {
      expect(keys).not.toContain("monthly");
    });

    it("has no current value, because its value is arithmetic", () => {
      expect(keys).not.toContain("currentValue");
    });
  });

  describe("a SIP", () => {
    const keys = keysFor(InvestmentType.SIP);

    it("leads with the monthly payment, which is what it is run by", () => {
      expect(keys).toContain("monthly");
      expect(keys).toContain("invested");
    });

    it("shows the step-up, which most of what distinguishes it", () => {
      expect(keys).toContain("stepUp");
    });

    it("has no compounding column", () => {
      expect(keys).not.toContain("compounding");
    });
  });

  describe("a recurring deposit", () => {
    it("shows the monthly payment", () => {
      const keys = keysFor(InvestmentType.RD);

      expect(keys).toContain("monthly");
    });

    it("has no step-up, which belongs to a SIP alone", () => {
      expect(keysFor(InvestmentType.RD)).not.toContain("stepUp");
    });
  });

  describe("a market-linked holding", () => {
    const keys = keysFor(InvestmentType.STOCKS);

    it("omits the rate, which a share price does not have", () => {
      expect(keys).not.toContain("rate");
    });

    it("omits the compounding, because nothing compounds a market price", () => {
      expect(keys).not.toContain("compounding");
    });

    it("omits the end date, because a market has no maturity", () => {
      expect(keys).not.toContain("dates");
    });

    it("still shows what went in, and what it is worth", () => {
      expect(keys).toContain("invested");
      expect(keys).toContain("value");
    });
  });

  describe("a savings balance", () => {
    it("has a rate but no end date", () => {
      const keys = keysFor(InvestmentType.SAVINGS);

      expect(keys).toContain("rate");
      // A balance accrues; it does not mature.
      expect(keys).not.toContain("dates");
    });
  });

  it("gives every kind a table that still answers what it is worth", () => {
    for (const type of Object.values(InvestmentType)) {
      const keys = keysFor(type);

      expect(keys).toContain("title");
      expect(keys).toContain("value");
      expect(keys).toContain("maturity");
    }
  });

  it("shows the maturity value where the profit column used to sit", () => {
    /*
     * The profit column is gone, and the maturity value is in its place rather than appended
     * after the dates — a reader scanning the row finds it where they used to look.
     */
    for (const type of [...Object.values(InvestmentType), null] as const) {
      const keys = keysFor(type);

      expect(keys).not.toContain("profit");
      expect(keys.indexOf("maturity")).toBe(keys.indexOf("value") + 1);
    }
  });

  it("quotes the end-of-term figure, not today's, beside what it is worth now", () => {
    /*
     * The distinction the two columns exist to keep separate. Read through the real projection,
     * since a deposit that has not matured has a maturity value well above what it is worth
     * today — which is the whole point of showing it.
     */
    const columns = investmentColumns(projectInvestment, InvestmentType.FD);
    const holding = investment({ startDate: "2026-01-05", tenureYears: 5 });

    const worthNow = renderCell(
      columns.find((column) => column.key === "value")?.render(holding)
    );
    const maturity = renderCell(
      columns.find((column) => column.key === "maturity")?.render(holding)
    );

    expect(maturity).not.toBe(worthNow);
    expect(maturity).not.toBe("-");
  });

  it("says a dash rather than a zero when there is nothing to work out", () => {
    // The real projection, because a stub answers the same for every holding and so cannot
    // report the "cannot be worked out" case at all.
    const columns = investmentColumns(projectInvestment, InvestmentType.FD);
    const maturity = columns.find((column) => column.key === "maturity");

    // A zero claims the holding is worth nothing; a dash says the figures are incomplete.
    expect(maturity?.render(investment({ amount: null }))).toBe("-");
  });

  it("shows neither the compounding nor the status on any table", () => {
    /*
     * Both are still recorded and both are still asked for in the form — they are simply not
     * columns. The compounding is a line in the arithmetic behind "Worth now" rather than
     * something a reader compares row to row, and the status is the same fact for most of a
     * portfolio, so a column of near-identical words was width spent to say nothing.
     *
     * Checked on the mixed table too, since it is a union and would reintroduce either one.
     */
    for (const type of [...Object.values(InvestmentType), null] as const) {
      const keys = keysFor(type);

      expect(keys).not.toContain("compounding");
      expect(keys).not.toContain("status");
    }
  });

  it("never puts both amounts on one table", () => {
    for (const type of Object.values(InvestmentType)) {
      const keys = keysFor(type);
      const monthly = keys.includes("monthly");

      expect(monthly).toBe(
        [InvestmentType.RD, InvestmentType.SIP, InvestmentType.EPF, InvestmentType.NPS].includes(
          type
        )
      );
    }
  });

  it("drops the compounding column without dropping what it does to the value", () => {
    /*
     * The frequency is no longer a column, but it is still stored and it still decides the
     * number — so a yearly-compounded deposit must not now be worth the same as a monthly one.
     * The column went; the arithmetic it was reporting on did not.
     *
     * Read through the real projection, not the stub above, which answers the same for every
     * holding and so could not tell the two apart.
     */
    const columns = investmentColumns(projectInvestment, InvestmentType.FD);
    const worthNow = columns.find((column) => column.key === "value");

    const yearly = renderCell(
      worthNow?.render(investment({ compoundingsPerYear: 1, tenureYears: 5 }))
    );
    const monthly = renderCell(
      worthNow?.render(investment({ compoundingsPerYear: 12, tenureYears: 5 }))
    );

    expect(columns.map((column) => column.key)).not.toContain("compounding");
    expect(yearly).not.toBe(monthly);
  });

  it("leaves the step-up out of a SIP that has none", () => {
    const columns = investmentColumns(projectionFor, InvestmentType.SIP);
    const stepUp = columns.find((column) => column.key === "stepUp");

    expect(stepUp?.render(investment({ stepUpPercent: null }))).toBe("-");
    expect(stepUp?.render(investment({ stepUpPercent: 0 }))).toBe("-");
    expect(stepUp?.render(investment({ stepUpPercent: 10 }))).toContain("10");
  });
});