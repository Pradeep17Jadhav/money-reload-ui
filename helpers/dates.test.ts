import {
  daysBetweenDateOnly,
  formatDateOnly,
  humaniseEnumValue,
  isDateOnly,
  toDateOnly,
  todayAsDateOnly,
} from "@/helpers/dates";

describe("dates", () => {
  it("recognises a date-only value", () => {
    expect(isDateOnly("2026-03-15")).toBe(true);
    expect(isDateOnly("2026-03-15T00:00:00Z")).toBe(false);
    expect(isDateOnly("15/03/2026")).toBe(false);
  });

  describe("formatDateOnly", () => {
    it("formats a calendar date without shifting it a day", () => {
      // Parsing this as UTC and rendering it back would show 14 Mar for anyone
      // west of Greenwich, so the helpers work on the string parts only.
      expect(formatDateOnly("2026-03-15")).toBe("15 Mar 2026");
      expect(formatDateOnly("2026-01-01")).toBe("1 Jan 2026");
      expect(formatDateOnly("2026-12-31")).toBe("31 Dec 2026");
    });

    it("shows a dash for an absent or malformed value", () => {
      expect(formatDateOnly(null)).toBe("-");
      expect(formatDateOnly(undefined)).toBe("-");
      expect(formatDateOnly("not-a-date")).toBe("-");
    });
  });

  describe("toDateOnly", () => {
    it("uses the local calendar date, not UTC", () => {
      // 23:30 local on the 15th is already the 16th in UTC east of Greenwich,
      // and still the 15th in the west. Only the local parts are correct.
      const lateEvening = new Date(2026, 2, 15, 23, 30);
      expect(toDateOnly(lateEvening)).toBe("2026-03-15");
    });

    it("zero-pads single digit months and days", () => {
      expect(toDateOnly(new Date(2026, 0, 5))).toBe("2026-01-05");
    });

    it("produces a value the server will accept", () => {
      expect(isDateOnly(todayAsDateOnly())).toBe(true);
    });
  });

  describe("daysBetweenDateOnly", () => {
    it("counts whole days between two calendar dates", () => {
      expect(daysBetweenDateOnly("2026-03-15", "2026-03-16")).toBe(1);
      expect(daysBetweenDateOnly("2026-03-15", "2026-04-15")).toBe(31);
      expect(daysBetweenDateOnly("2026-03-15", "2026-03-15")).toBe(0);
    });

    it("goes negative once the date has passed", () => {
      expect(daysBetweenDateOnly("2026-03-16", "2026-03-15")).toBe(-1);
    });

    it("crosses a year boundary", () => {
      expect(daysBetweenDateOnly("2025-12-31", "2026-01-01")).toBe(1);
    });
  });

  it("humanises an enum value for display", () => {
    expect(humaniseEnumValue("loan_repayment")).toBe("Loan repayment");
    expect(humaniseEnumValue("upi")).toBe("Upi");
    expect(humaniseEnumValue("bank_account")).toBe("Bank account");
  });
});