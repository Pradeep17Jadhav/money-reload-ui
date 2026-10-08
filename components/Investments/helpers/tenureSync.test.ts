import {
  dateAfter,
  deriveInvestmentEditValues,
  syncTerminateOnChange,
  termBetween,
} from "@/components/Investments/helpers/tenureSync";
import type { FormValues } from "@/types/RecordFormTypes";

/** The form's state with a start date and a term already chosen. */
const form = (overrides: FormValues = {}): FormValues => ({
  startDate: "2026-01-05",
  tenureYears: "5",
  tenureMonths: "0",
  tenureDays: "0",
  endDate: "2031-01-05",
  ...overrides,
});

describe("reading a term off two dates", () => {
  it("gives whole years, months and days", () => {
    expect(termBetween("2026-01-05", "2031-04-18")).toEqual({
      years: 5,
      months: 3,
      days: 13,
    });
  });

  it("reads a whole year as exactly that, with nothing left over", () => {
    expect(termBetween("2026-01-05", "2027-01-05")).toEqual({
      years: 1,
      months: 0,
      days: 0,
    });
  });

  it("keeps the day of the month, rather than snapping to the 1st", () => {
    /*
     * The naive subtraction says Jan 31 to Mar 1 is two months. It is not: `start.add(2,
     * "month")` is Mar 31, a month *past* the end, so the answer is a month and a day.
     */
    expect(termBetween("2026-01-31", "2026-03-01")).toEqual({
      years: 0,
      months: 1,
      days: 1,
    });
  });

  it("round-trips, which is what makes either spelling authoritative", () => {
    for (const [start, end] of [
      ["2026-01-05", "2031-01-05"],
      ["2026-01-31", "2026-03-01"],
      ["2024-02-29", "2030-02-28"],
      ["2026-12-31", "2027-01-30"],
    ] as const) {
      const term = termBetween(start, end);

      expect(term).not.toBeNull();
      expect(dateAfter(start, term!)).toBe(end);
    }
  });

  it("has no answer for an end date before the start", () => {
    // A term runs forwards. There is no negative one to report.
    expect(termBetween("2026-01-05", "2025-12-31")).toBeNull();
  });

  it("accepts an end date on the start date itself", () => {
    expect(termBetween("2026-01-05", "2026-01-05")).toEqual({
      years: 0,
      months: 0,
      days: 0,
    });
  });
});

describe("the latest selection wins", () => {
  it("an end date rewrites all three pickers", () => {
    const patch = syncTerminateOnChange({
      name: "endDate",
      value: "2031-04-18",
      current: form(),
    });

    expect(patch).toEqual({
      tenureYears: "5",
      tenureMonths: "3",
      tenureDays: "13",
    });
  });

  it("a picker rewrites the end date", () => {
    const patch = syncTerminateOnChange({
      name: "tenureMonths",
      value: "6",
      current: form(),
    });

    expect(patch).toEqual({ endDate: "2031-07-05" });
  });

  it("a picker leaves the other two alone", () => {
    /*
     * "Latest wins" means the picker the user just touched is the one that counts. Re-deriving
     * the years from the months as well would quietly undo the keystroke that came first.
     */
    const patch = syncTerminateOnChange({
      name: "tenureMonths",
      value: "6",
      current: form({ tenureYears: "2" }),
    });

    expect(patch).toEqual({ endDate: "2028-07-05" });
    expect(patch).not.toHaveProperty("tenureYears");
  });

  it("an end date leaves the other dates alone", () => {
    const patch = syncTerminateOnChange({
      name: "endDate",
      value: "2027-01-05",
      current: form(),
    });

    // It is the field the user just set; the caller applies that, so it must not come back here.
    expect(patch).not.toHaveProperty("endDate");
    expect(patch).not.toHaveProperty("startDate");
  });

  it("a term of zero clears the end date, because no term has no end", () => {
    const patch = syncTerminateOnChange({
      name: "tenureYears",
      value: "0",
      current: form({ tenureYears: "5", tenureMonths: "0", tenureDays: "0" }),
    });

    expect(patch).toEqual({ endDate: "" });
  });

  it("a new start date carries the end date with it", () => {
    // A term is a length, so moving the start moves the end by the same length.
    const patch = syncTerminateOnChange({
      name: "startDate",
      value: "2027-07-09",
      current: form(),
    });

    expect(patch).toEqual({ endDate: "2032-07-09" });
  });

  it("clearing the start date clears the end date", () => {
    const patch = syncTerminateOnChange({
      name: "startDate",
      value: "",
      current: form(),
    });

    // Nothing to count forward from, so an end date left behind would be floating free.
    expect(patch).toEqual({ endDate: "" });
  });

  it("moves nothing while there is no start date", () => {
    const patch = syncTerminateOnChange({
      name: "tenureYears",
      value: "7",
      current: form({ startDate: "" }),
    });

    expect(patch).toEqual({});
  });

  it("leaves a backwards end date alone, rather than writing a negative term", () => {
    const patch = syncTerminateOnChange({
      name: "endDate",
      value: "2025-01-01",
      current: form(),
    });

    // The rule on the form says so in words; the pickers stay as they were until it is fixed.
    expect(patch).toEqual({});
  });

  it("ignores a field that has nothing to do with the term", () => {
    const patch = syncTerminateOnChange({
      name: "title",
      value: "Home loan",
      current: form(),
    });

    expect(patch).toEqual({});
  });
});

describe("opening an existing holding for editing", () => {
  it("fills the end date in from the term the record stores", () => {
    const seeded = deriveInvestmentEditValues(
      { startDate: "2026-01-05", tenureYears: "5", tenureMonths: "6", tenureDays: "0" },
      {}
    );

    // Blank would look like the holding had lost its maturity, beside three pickers that
    // plainly already hold an answer.
    expect(seeded.endDate).toBe("2031-07-05");
  });

  it("leaves it blank for a holding with no term", () => {
    const seeded = deriveInvestmentEditValues(
      { startDate: "2026-01-05", tenureYears: "0", tenureMonths: "0", tenureDays: "0" },
      {}
    );

    expect(seeded.endDate).toBe("");
  });

  it("agrees with what the picker would have written", () => {
    const values = form({ endDate: "" });

    const derived = deriveInvestmentEditValues(values, {});
    const picked = syncTerminateOnChange({
      name: "tenureYears",
      value: "5",
      current: { ...values, endDate: "" },
    });

    expect(derived.endDate).toBe(picked.endDate);
  });
});