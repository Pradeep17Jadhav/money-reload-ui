import { INVESTMENT_FIELDS } from "@/components/Investments/InvestmentsConfig";
import {
  getVisibleFields,
  buildPayload,
  valuesFromRecord,
} from "@/helpers/recordForm";
import { InvestmentType } from "@/types/FinanceTypes";
import type { FormValues } from "@/types/RecordFormTypes";

/** The names on screen for one type, which is what a user actually sees and is held to. */
const shownFor = (type: InvestmentType): string[] =>
  getVisibleFields(
    INVESTMENT_FIELDS,
    { type } as FormValues
  ).map((field) => field.name);

const payloadFor = (values: FormValues): Record<string, unknown> =>
  buildPayload(INVESTMENT_FIELDS, values);

describe("the investment form", () => {
  it("asks a fixed deposit for an amount, a rate and a term", () => {
    const shown = shownFor(InvestmentType.FD);

    // Exactly what the user types. No maturity value, no profit — each of those is arithmetic
    // over these and would be a second source of truth to go stale.
    expect(shown).toContain("amount");
    expect(shown).toContain("rate");
    expect(shown).toContain("tenureYears");
    expect(shown).toContain("compoundingsPerYear");

    expect(shown).not.toContain("monthlyAmount");
    expect(shown).not.toContain("currentValue");
    expect(shown).not.toContain("maturityValue");
  });

  it("offers an end date for a holding that has a term", () => {
    // The term as a date, because "5 years, 0 months, 0 days" is harder to picture than a date
    // you can read back. It sits right after the start date it is counted from.
    const shown = shownFor(InvestmentType.FD);

    expect(shown).toContain("endDate");
    expect(shown.indexOf("endDate")).toBe(shown.indexOf("startDate") + 1);
  });

  it("never sends an end date, because the API does not store one", () => {
    /*
     * The investments endpoint is strict: a body carrying a key it does not list is rejected
     * outright. The end date is worked out from the term, so sending it would be refused — the
     * form shows it, and the term alone goes on the wire.
     */
    const payload = payloadFor({
      type: InvestmentType.FD,
      title: "FD",
      startDate: "2026-01-05",
      endDate: "2031-01-05",
      amount: "500000",
      rate: "7.25",
      tenureYears: "5",
      tenureMonths: "0",
      tenureDays: "0",
    });

    expect(payload).not.toHaveProperty("endDate");
    // The term still is — that is where the date comes from.
    expect(payload).toMatchObject({ tenureYears: 5, tenureMonths: 0, tenureDays: 0 });
  });

  it("offers no end date where there is no term", () => {
    // A balance accrues and a share price has no maturity, so an end date would invent one.
    expect(shownFor(InvestmentType.SAVINGS)).not.toContain("endDate");
    expect(shownFor(InvestmentType.STOCKS)).not.toContain("endDate");
  });

  it("asks the term as three pickers bounded by what the API accepts", () => {
    for (const [name, max] of [
      ["tenureYears", 50],
      ["tenureMonths", 11],
      ["tenureDays", 30],
    ] as const) {
      const field = INVESTMENT_FIELDS.find((entry) => entry.name === name);

      expect(field?.kind).toBe("select");
      // `numeric`, or the option's "5" would be posted as a string and refused.
      expect(field).toMatchObject({ numeric: true });
      expect(field?.kind === "select" ? field.options.length : 0).toBe(max + 1);
      expect(field?.kind === "select" ? field.options.at(-1)?.value : "").toBe(String(max));
    }
  });

  it("sends the picked term as numbers, like the frequency", () => {
    const payload = payloadFor({
      type: InvestmentType.FD,
      title: "FD",
      startDate: "2026-01-05",
      amount: "500000",
      rate: "7.25",
      tenureYears: "5",
      tenureMonths: "6",
      tenureDays: "15",
    });

    expect(payload.tenureYears).toBe(5);
    expect(payload.tenureMonths).toBe(6);
    expect(payload.tenureDays).toBe(15);
  });

  it("still sends a term of zero, which is a choice and not an absence", () => {
    const payload = payloadFor({
      type: InvestmentType.FD,
      title: "FD",
      startDate: "2026-01-05",
      amount: "500000",
      rate: "7.25",
      tenureYears: "0",
    });

    // `"0"` is truthy as a string, so it survives the blank check and posts as 0.
    expect(payload.tenureYears).toBe(0);
  });

  it("asks a recurring deposit for a monthly amount instead", () => {
    const shown = shownFor(InvestmentType.RD);

    expect(shown).toContain("monthlyAmount");
    // The type decides which amount means anything, so the other is not even on screen.
    expect(shown).not.toContain("amount");
  });

  it("offers a step-up on a SIP and nowhere else", () => {
    expect(shownFor(InvestmentType.SIP)).toContain("stepUpPercent");
    expect(shownFor(InvestmentType.RD)).not.toContain("stepUpPercent");
    expect(shownFor(InvestmentType.FD)).not.toContain("stepUpPercent");
  });

  it("asks a shareholding what it is worth, and nothing it cannot answer", () => {
    const shown = shownFor(InvestmentType.STOCKS);

    /*
     * No share price compounds at a declared rate, so there is no rate to ask for and no term
     * to run. Asking for either would invite a number nothing could act on.
     */
    expect(shown).toContain("amount");
    expect(shown).toContain("currentValue");
    expect(shown).not.toContain("rate");
    expect(shown).not.toContain("tenureYears");
    expect(shown).not.toContain("compoundingsPerYear");
  });

  it("asks a savings balance for a rate but not a term", () => {
    const shown = shownFor(InvestmentType.SAVINGS);

    // A balance accrues; it does not mature, so a term would invent an end date.
    expect(shown).toContain("rate");
    expect(shown).not.toContain("tenureYears");
  });

  it("never asks for both amounts at once", () => {
    for (const type of Object.values(InvestmentType)) {
      const shown = shownFor(type);
      const both = shown.includes("amount") && shown.includes("monthlyAmount");

      expect(both).toBe(false);
    }
  });

  it("sends only the fields it asked for", () => {
    const payload = payloadFor({
      type: InvestmentType.STOCKS,
      title: "Index fund",
      startDate: "2026-01-05",
      amount: "200000",
      currentValue: "265000",
      // Left over from choosing a fixed deposit first. Must not be sent, or the API would
      // have to decide whether to store a rate on a holding that has none.
      rate: "12",
      tenureYears: "5",
    });

    expect(payload).toMatchObject({
      title: "Index fund",
      amount: 20_000_000,
      currentValue: 26_500_000,
    });
    expect(payload).not.toHaveProperty("rate");
    expect(payload).not.toHaveProperty("tenureYears");
  });

  it("converts money to paise, as every other amount on this app", () => {
    const payload = payloadFor({
      type: InvestmentType.FD,
      title: "FD",
      startDate: "2026-01-05",
      amount: "500000",
      rate: "7.25",
      tenureYears: "5",
    });

    // Rs 5,00,000.00 exactly, with no float having touched it on the way through.
    expect(payload.amount).toBe(50_000_000);
  });

  it("holds a visible required field to its value, and ignores a hidden one", () => {
    const payload = payloadFor({
      type: InvestmentType.FD,
      title: "",
      startDate: "2026-01-05",
      // Blank, though the form would not let it through: `validateForm` only holds you to a
      // field that is visible, so a required field out of context is simply not asked for.
      monthlyAmount: "",
    });

    expect(payload).not.toHaveProperty("monthlyAmount");
  });

  it("sends the compounding frequency as a number, not as the option's string", () => {
    /*
     * Regression. A dropdown can only hold string values, so "Quarterly" arrives as `"4"`,
     * and the API rejects it with `expected number, received string`. The field says
     * `numeric` so `buildPayload` converts it back.
     */
    const payload = payloadFor({
      type: InvestmentType.FD,
      title: "FD",
      startDate: "2026-01-05",
      amount: "500000",
      rate: "7.25",
      tenureYears: "5",
      compoundingsPerYear: "4",
    });

    expect(payload.compoundingsPerYear).toBe(4);
    expect(typeof payload.compoundingsPerYear).toBe("number");
  });

  it("still sends every other select as the string it is", () => {
    const payload = payloadFor({
      type: InvestmentType.FD,
      title: "FD",
      startDate: "2026-01-05",
      amount: "500000",
      rate: "7.25",
      tenureYears: "5",
      type_other_never: "",
    });

    // `type` and `status` are genuine string enums. Marking them numeric would be as wrong as
    // the opposite mistake, so the flag is opt-in per field rather than inferred.
    expect(payload.type).toBe("fd");
    expect(typeof payload.type).toBe("string");
  });

  it("reads a stored frequency back into the dropdown", () => {
    const values = valuesFromRecord(
      { type: "fd", title: "FD", compoundingsPerYear: 4 },
      INVESTMENT_FIELDS
    );

    // The option's value is the string `"4"`, so the form has to hold the string to match it.
    expect(values.compoundingsPerYear).toBe("4");
  });

  it("leaves the frequency out when the user has not chosen one", () => {
    const payload = payloadFor({
      type: InvestmentType.FD,
      title: "FD",
      startDate: "2026-01-05",
      amount: "500000",
      rate: "7.25",
      tenureYears: "5",
      compoundingsPerYear: "",
    });

    // Absent rather than empty: the API stores `null`, and the projection defaults it to
    // quarterly — the same figure the FD calculator quotes.
    expect("compoundingsPerYear" in payload).toBe(false);
  });

  it("keeps the type and title on screen for every kind", () => {
    for (const type of Object.values(InvestmentType)) {
      const shown = shownFor(type);

      expect(shown).toContain("type");
      expect(shown).toContain("title");
      expect(shown).toContain("startDate");
    }
  });
});