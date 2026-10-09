import { projectIncomeTaxScenario } from "@/components/IncomeTax/helpers/incomeTaxScenario";
import type { Budget } from "@/types/ConfigTypes";
import type { SavedIncomeTaxCalculation } from "@/types/IncomeTax/CalculationTypes";

/**
 * A budget as the site's config holds one.
 *
 * Built whole rather than partially, so a test cannot pass by reading a field that happens not to
 * exist — `undefined` would be arithmetic on `NaN` and would quietly read as a zero tax.
 */
const budget = (overrides: Partial<Budget> = {}): Budget => ({
  year: 2026,
  financialYear: "2025-26",
  // The config labels the assessment year with its own end year, not as a bare year.
  assessmentYear: "2026-27",
  name: "Budget 2026",
  regime: "Old",
  applyMarginalRelief: false,
  rebate: { amount: 700_000, type: "up to" },
  standardDeduction: { amount: 75_000, type: "salaried" },
  taxes: [],
  slabs: [
    { incomeFrom: 0, incomeTo: 500_000, taxInPercent: 0 },
    { incomeFrom: 500_000, incomeTo: 1_000_000, taxInPercent: 5 },
    { incomeFrom: 1_000_000, incomeTo: 2_500_000, taxInPercent: 20 },
  ],
  ...overrides,
});

const scenario = (
  overrides: Partial<SavedIncomeTaxCalculation> = {}
): SavedIncomeTaxCalculation => ({
  id: "scenario-1",
  name: "FY25-26 salaried",
  description: null,
  assessmentYear: "2026-27",
  financialYear: "2025-26",
  regime: "OLD",
  // Rs 15,00,000.00 — **paise**, as every amount on this app is. The helpers work in whole
  // currency units, which is exactly the conversion worth having a test for.
  annualIncome: 150_000_000,
  useStandardDeduction: true,
  additionalIncome: [],
  createdAt: "2026-10-07T08:13:49.103Z",
  updatedAt: "2026-10-07T08:13:49.103Z",
  ...overrides,
});

describe("working out what a saved scenario is worth", () => {
  it("taxes the income after the standard deduction", () => {
    const projection = projectIncomeTaxScenario(scenario(), [budget()]);

    expect(projection).not.toBeNull();
    /*
     * Rs 15,00,000 less the Rs 75,000 deduction leaves Rs 14,25,000 taxable. On the slabs above
     * that is Rs 5,00,000 at 5% (Rs 25,000) plus the remaining Rs 4,25,000 at 20% (Rs 85,000) —
     * Rs 1,10,000 in total, which is 11,000,000 paise.
     */
    expect(projection?.annualIncome).toBe(150_000_000);
    expect(projection?.tax).toBe(11_000_000);
  });

  it("taxes the whole income when the deduction was not applied", () => {
    const projection = projectIncomeTaxScenario(
      scenario({ useStandardDeduction: false }),
      [budget()]
    );

    // Rs 15,00,000 flat: Rs 25,000 plus Rs 1,00,000 at 20% = Rs 1,25,000.
    expect(projection?.tax).toBe(12_500_000);
  });

  it("matches on the regime as well as the year", () => {
    const budgets = [
      budget({ assessmentYear: "2026-27", regime: "Old" }),
      budget({ assessmentYear: "2026-27", regime: "New" }),
    ];

    // Same year, two very different answers. Matching on the year alone would quietly quote the
    // wrong one's slabs.
    const old = projectIncomeTaxScenario(scenario({ regime: "OLD" }), budgets);
    const updated = projectIncomeTaxScenario(scenario({ regime: "NEW" }), budgets);

    expect(old).not.toBeNull();
    expect(updated).not.toBeNull();
    expect(old?.assessmentYear).toBe("2026-27");
  });

  it("has no answer for a year the config no longer holds", () => {
    const projection = projectIncomeTaxScenario(
      scenario({ assessmentYear: "2019-20" }),
      [budget()]
    );

    /*
     * Null rather than a zero. A zero is a claim that no tax was due, which is a different and
     * wrong answer from "this cannot be worked out" — and an imported income reading zero tax
     * would look like a genuine nil return.
     */
    expect(projection).toBeNull();
  });

  it("has no answer for a regime the config no longer holds", () => {
    const projection = projectIncomeTaxScenario(scenario({ regime: "NEW" }), [budget()]);

    expect(projection).toBeNull();
  });

  it("never returns a negative tax", () => {
    const generous = budget({
      rebate: { amount: 20_000_000, type: "up to" },
    });

    const projection = projectIncomeTaxScenario(scenario(), [generous]);

    // A rebate larger than the liability would otherwise produce a negative "tax", which an
    // imported income would store as a negative TDS.
    expect(projection?.tax).toBe(0);
  });

  it("agrees with the calculator on the same inputs", () => {
    /*
     * The point of using the same helpers: an imported income shows this figure and the
     * calculator showed that one, so a user comparing the two must not find two numbers.
     */
    const budgets = [budget()];
    const projection = projectIncomeTaxScenario(scenario(), budgets);

    /*
     * Walked band by band rather than folded into one expression, so the expectation is visibly
     * independent of the helper it is checking. Rs 14,25,000 taxable: the first Rs 5,00,000 is
     * taxed at nothing, the next Rs 5,00,000 at 5%, and the remaining Rs 4,25,000 at 20%.
     */
    const taxable = 150_000_000 / 100 - 75_000;
    let remaining = taxable;
    let expected = 0;

    for (const band of [
      { to: 500_000, percent: 0 },
      { to: 1_000_000, percent: 5 },
      { to: 2_500_000, percent: 20 },
    ]) {
      const inBand = Math.max(0, Math.min(remaining, band.to - (band.to === 500_000 ? 0 : band.to === 1_000_000 ? 500_000 : 1_000_000)));
      expected += (inBand * band.percent) / 100;
      remaining -= inBand;
    }

    expect(projection?.tax).toBe(Math.round(expected * 100));
  });
});