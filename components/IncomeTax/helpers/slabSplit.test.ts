import { splitTaxAcrossSlabs } from "@/components/IncomeTax/helpers/slabSplit";
import type { TaxSlab } from "@/types/ConfigTypes";

/**
 * 0% up to 5 lakh, 5% to 10 lakh, 20% above — the shape the old-regime slabs have, chosen
 * because the open-ended final band is the case worth getting right.
 */
const slabs: TaxSlab[] = [
  { incomeFrom: 0, incomeTo: 500_000, taxInPercent: 0 },
  { incomeFrom: 500_000, incomeTo: 1_000_000, taxInPercent: 5 },
  { incomeFrom: 1_000_000, incomeTo: -1, taxInPercent: 20 },
];

describe("two incomes against one set of slabs", () => {
  it("taxes the main income alone when there is no additional income", () => {
    const { mainTax, additionalTax } = splitTaxAcrossSlabs(slabs, 1_000_000, 0);

    expect(mainTax).toBe(25_000);
    expect(additionalTax).toBe(0);
  });

  it("gives the additional income only the slabs the salary left", () => {
    /*
     * The salary of 8,00,000 fills the 0% band and 3,00,000 of the 5% band, so Rs 15,000 of tax.
     * The additional Rs 4,00,000 picks up the remaining Rs 2,00,000 of that band (Rs 10,000) and
     * Rs 2,00,000 of the 20% band (Rs 40,000) — Rs 50,000.
     */
    const { mainTax, additionalTax } = splitTaxAcrossSlabs(slabs, 800_000, 400_000);

    expect(mainTax).toBe(15_000);
    expect(additionalTax).toBe(50_000);
  });

  it("taxes the side income more heavily per rupee than the salary", () => {
    /*
     * The requirement, stated as a rate rather than a total. With the salary of Rs 8,00,000 first,
     * it clears the 0% band and Rs 3,00,000 of the 5% band — Rs 15,000, an average 1.9%. The side
     * income of Rs 4,00,000 only reaches the leftover 5% and the 20% band — Rs 50,000, an average
     * 12.5%. The ordering is the whole behaviour: it decides who gets the cheap bands.
     */
    const { mainTax, additionalTax } = splitTaxAcrossSlabs(slabs, 800_000, 400_000);

    expect(mainTax / 800_000).toBeLessThan(additionalTax / 400_000);
  });

  it("charges a side income the top rate once the salary has cleared the lower bands", () => {
    const { mainTax, additionalTax } = splitTaxAcrossSlabs(slabs, 1_200_000, 100_000);

    // Salary: 0 on the first band, 25,000 on the second, 40,000 of the third.
    expect(mainTax).toBe(65_000);
    /*
     * The side income is **not** taxed at 5%. By the time it is reached the salary has taken the
     * whole 5% band, so it lands on the open 20% band — which is precisely why the order matters.
     */
    expect(additionalTax).toBe(20_000);
  });

  it("absorbs anything left into an open-ended final band", () => {
    const { mainTax, additionalTax } = splitTaxAcrossSlabs(slabs, 2_000_000, 1_000_000);

    // Salary: 0 on the first band, 25,000 on the second, 20,00,000's share of the third.
    expect(mainTax).toBe(225_000);
    // Side income: all of it on the open 20% band, because the salary took 10,00,000 of it.
    expect(additionalTax).toBe(200_000);
  });

  it("reports the open-ended band as far as it reached", () => {
    const { rows } = splitTaxAcrossSlabs(slabs, 2_000_000, 0);
    const last = rows[rows.length - 1];

    // The config has no upper figure for this band; showing one would put an arbitrary number in
    // the summary.
    expect(last?.incomeTo).toBe(2_000_000);
    expect(last?.incomeFrom).toBe(1_000_000);
  });

  it("reports no band that was not reached", () => {
    const { rows } = splitTaxAcrossSlabs(slabs, 300_000, 0);

    expect(rows).toHaveLength(1);
    expect(rows[0].applicableTax).toBe(0);
  });

  it("charges nothing for no income at all", () => {
    expect(splitTaxAcrossSlabs(slabs, 0, 0)).toMatchObject({
      mainTax: 0,
      additionalTax: 0,
      rows: [],
    });
  });

  it("ignores a negative income rather than taxing a band in reverse", () => {
    const { mainTax, additionalTax } = splitTaxAcrossSlabs(slabs, -100, -100);

    expect(mainTax).toBe(0);
    expect(additionalTax).toBe(0);
  });
});