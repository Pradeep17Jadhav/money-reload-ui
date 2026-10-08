import {
  fixedDepositValue,
  lumpsumValue,
  monthsIn,
  recurringDepositValue,
  sipValue,
  summariseReturns,
} from "@/components/Common/CommonCalculator/helpers/returns";

/**
 * These were lifted out of `useCalculator` so `/investments` could reuse them. The first
 * version of that lift dropped a `/100` when turning a percentage into a rate, which quietly
 * compounded 7.25% as 725% and made every deposit look worth more than the GDP of a small
 * country. Nothing caught it at the time, because the calculator page tests were already
 * failing for unrelated reasons — so these assert the arithmetic directly, against figures
 * worked out by hand rather than against the implementation.
 */
describe("converting a tenure to months", () => {
  it("counts whole years and months", () => {
    expect(monthsIn({ years: 2, months: 6, days: 0 })).toBe(30);
  });

  it("carries a partial month rather than discarding the days", () => {
    // The calculators' own convention, kept so a tenure of years + months + days means the
    // same thing here as it does on screen.
    expect(monthsIn({ years: 0, months: 0, days: 30.4375 })).toBeCloseTo(1, 6);
  });

  it("treats a year as twelve months", () => {
    expect(monthsIn({ years: 1, months: 0, days: 0 })).toBe(12);
  });
});

describe("a fixed deposit", () => {
  it("compounds quarterly at the annual rate", () => {
    /*
     * Rs 1,00,000 at 8% compounded quarterly for 5 years.
     *
     * Hand-worked: 8% / 4 = 2% a quarter, 20 quarters, so 100,000 × 1.02^20.
     * 1.02^20 = 1.48594739598...
     */
    const value = fixedDepositValue({
      amount: 100_000,
      rate: 8,
      tenure: { years: 5, months: 0, days: 0 },
      compoundingsPerYear: 4,
    });

    expect(value).toBe(Math.round(100_000 * Math.pow(1.02, 20)));
    expect(value).toBe(148_595);
  });

  it("reads the rate as a percentage, not as a decimal multiple", () => {
    // The regression that motivated this file. 8% must not compound as 200% a quarter.
    const eight = fixedDepositValue({
      amount: 100_000,
      rate: 8,
      tenure: { years: 1, months: 0, days: 0 },
      compoundingsPerYear: 4,
    });
    const eightHundred = fixedDepositValue({
      amount: 100_000,
      rate: 800,
      tenure: { years: 1, months: 0, days: 0 },
      compoundingsPerYear: 4,
    });

    expect(eight).toBeLessThan(110_000);
    // 800% read as a decimal would compound at 200% a quarter: 100,000 × 3^4 = 8,100,000.
    expect(eightHundred).toBe(8_100_000);
  });

  it("earns more when it compounds more often", () => {
    const args = { amount: 100_000, rate: 8, tenure: { years: 5, months: 0, days: 0 } };

    expect(fixedDepositValue({ ...args, compoundingsPerYear: 12 })).toBeGreaterThan(
      fixedDepositValue({ ...args, compoundingsPerYear: 4 })
    );
  });

  it("returns the amount unchanged when the rate is nothing", () => {
    expect(
      fixedDepositValue({
        amount: 100_000,
        rate: 0,
        tenure: { years: 5, months: 0, days: 0 },
        compoundingsPerYear: 4,
      })
    ).toBe(100_000);
  });

  it("grows by the same formula as a lump sum", () => {
    const args = {
      amount: 250_000,
      rate: 11,
      tenure: { years: 7, months: 3, days: 0 },
      compoundingsPerYear: 4,
    };

    expect(lumpsumValue(args)).toBe(fixedDepositValue(args));
  });
});

describe("a recurring deposit", () => {
  it("grows each instalment only for the months it was held", () => {
    /*
     * Rs 1,000 a month at 6% compounded quarterly, for 1 year.
     *
     * Hand-worked: the first instalment is held 12 months, the last for 1 month, at 1.5% a
     * quarter. So 1000 × (1.015^12 + 1.015^11 + ... + 1.015^1).
     */
    const value = recurringDepositValue({
      monthlyAmount: 1_000,
      rate: 6,
      tenure: { years: 1, months: 0, days: 0 },
      compoundingsPerYear: 4,
    });

    let handWorked = 0;

    for (let monthsLeft = 12; monthsLeft >= 1; monthsLeft -= 1) {
      handWorked += 1_000 * Math.pow(1.015, monthsLeft / 3);
    }

    expect(value).toBe(Math.round(handWorked));
  });

  it("takes longer to beat a lump sum, because late deposits earn less", () => {
    const lump = fixedDepositValue({
      amount: 120_000,
      rate: 7,
      tenure: { years: 1, months: 0, days: 0 },
      compoundingsPerYear: 4,
    });
    const recurring = recurringDepositValue({
      monthlyAmount: 10_000,
      rate: 7,
      tenure: { years: 1, months: 0, days: 0 },
      compoundingsPerYear: 4,
    });

    /*
     * The same 12,000 in total. The lump sum is worth more because all of it was invested
     * for the whole year, and that gap is the entire case for starting early.
     */
    expect(lump).toBeGreaterThan(recurring);
  });

  it("is not the same sum as a SIP at the same rate", () => {
    const rd = recurringDepositValue({
      monthlyAmount: 5_000,
      rate: 12,
      tenure: { years: 5, months: 0, days: 0 },
      compoundingsPerYear: 4,
    });
    const sip = sipValue({
      monthlyAmount: 5_000,
      rate: 12,
      tenure: { years: 5, months: 0, days: 0 },
    });

    // Four compoundings a year against twelve. Using one formula for both would make this
    // screen disagree with one of the two calculators it shares helpers with.
    expect(rd).not.toBe(sip);
  });
});

describe("a systematic investment plan", () => {
  it("grows an instalment made every month", () => {
    /*
     * Rs 10,000 a month at 12% for 10 years.
     *
     * Hand-worked: the monthly rate is (1.12)^(1/12) − 1 ≈ 0.00948879, and the future value
     * of an ordinary annuity due is P × ((1+i)^n − 1)/i × (1 + i).
     */
    const value = sipValue({
      monthlyAmount: 10_000,
      rate: 12,
      tenure: { years: 10, months: 0, days: 0 },
    });

    const i = Math.pow(1.12, 1 / 12) - 1;
    const handWorked =
      10_000 * ((Math.pow(1 + i, 120) - 1) / i) * (1 + i);

    expect(value).toBe(Math.round(handWorked));
  });

  it("charges nothing when the rate is nothing", () => {
    // At 0% a SIP simply hands back everything paid in.
    expect(
      sipValue({
        monthlyAmount: 10_000,
        rate: 0,
        tenure: { years: 1, months: 0, days: 0 },
      })
    ).toBe(120_000);
  });

  it("grows more with a step-up, because more goes in each year", () => {
    const args = {
      monthlyAmount: 10_000,
      rate: 12,
      tenure: { years: 10, months: 0, days: 0 },
    };

    expect(sipValue({ ...args, stepUpPercent: 10 })).toBeGreaterThan(
      sipValue(args)
    );
  });

  it("returns a lump sum already held when there is no term", () => {
    expect(
      sipValue({
        monthlyAmount: 1_000,
        rate: 12,
        tenure: { years: 0, months: 0, days: 0 },
        initialAmount: 50_000,
      })
    ).toBe(50_000);
  });
});

describe("summarising a return", () => {
  it("reports the gap between what went in and what it is worth", () => {
    expect(summariseReturns(100_000, 148_595)).toEqual({
      invested: 100_000,
      currentValue: 148_595,
      profit: 48_595,
      timesMultiplied: 1.49,
    });
  });

  it("reports a loss as a negative profit rather than a zero", () => {
    expect(summariseReturns(100_000, 80_000).profit).toBe(-20_000);
  });

  it("has no multiple for an investment of nothing", () => {
    // Dividing would give NaN into a table cell, which reads as a broken page rather than as
    // an honest "there is nothing here yet".
    expect(summariseReturns(0, 0).timesMultiplied).toBe(0);
  });
});