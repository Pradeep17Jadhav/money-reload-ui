import { formatPaise, formatPercent, rupeesToPaise, validateMoneyInput } from "@/helpers/money";

describe("money", () => {
  describe("display", () => {
    it("divides paise by 100 rather than formatting the raw integer", () => {
      expect(formatPaise(150050)).toContain("1,500.50");
      expect(formatPaise(500)).toContain("5.00");
      expect(formatPaise(0)).toContain("0.00");
    });

    it("treats 1500 as fifteen rupees, not fifteen hundred", () => {
      expect(formatPaise(1500)).toContain("15.00");
    });

    it("shows a dash for an absent amount rather than a zero", () => {
      expect(formatPaise(null)).toBe("-");
      expect(formatPaise(undefined)).toBe("-");
    });
  });

  describe("percentages are not money", () => {
    it("never divides a rate by 100", () => {
      expect(formatPercent(8.75)).toBe("8.75%");
      // Kept as two places, where the old formatter dropped the trailing zero.
      expect(formatPercent(7.5)).toBe("7.50%");
    });

    it("shows two places on a whole rate, because a rate is quoted to two", () => {
      /*
       * The opposite of what this used to do. A column reading `8%`, `8.5%` and `8.75%` reads
       * as three precisions rather than as one — and `8.5%` beside `8.50%` invites the reader
       * to wonder which of them was rounded.
       */
      expect(formatPercent(8)).toBe("8.00%");
      expect(formatPercent(6)).toBe("6.00%");
      expect(formatPercent(6.5)).toBe("6.50%");
      expect(formatPercent(0)).toBe("0.00%");
    });

    it("keeps a rate above one hundred readable rather than clipping it", () => {
      expect(formatPercent(1234.5)).toBe("1,234.50%");
    });
  });

  describe("rupeesToPaise", () => {
    it("converts rupees to integer paise", () => {
      expect(rupeesToPaise("1500.50")).toEqual({ ok: true, paise: 150050 });
      expect(rupeesToPaise("5")).toEqual({ ok: true, paise: 500 });
      expect(rupeesToPaise("0")).toEqual({ ok: true, paise: 0 });
    });

    it("rounds away the floating point error rather than losing a paise", () => {
      // 1234.56 * 100 is 123456.00000000001 in binary floating point.
      expect(rupeesToPaise("1234.56")).toEqual({ ok: true, paise: 123456 });
      expect(rupeesToPaise("0.07")).toEqual({ ok: true, paise: 7 });
    });

    it("tolerates Indian digit grouping", () => {
      expect(rupeesToPaise("1,50,050.25")).toEqual({ ok: true, paise: 15005025 });
    });

    it("rejects an empty value", () => {
      expect(rupeesToPaise("   ")).toEqual({ ok: false, reason: "empty" });
    });

    it("rejects more than two decimals, which the server has no paise for", () => {
      expect(rupeesToPaise("10.005")).toEqual({ ok: false, reason: "format" });
    });

    it("rejects anything that is not a plain number", () => {
      expect(rupeesToPaise("abc")).toEqual({ ok: false, reason: "format" });
      expect(rupeesToPaise("-5")).toEqual({ ok: false, reason: "format" });
      expect(rupeesToPaise("1e5")).toEqual({ ok: false, reason: "format" });
    });
  });

  describe("validateMoneyInput", () => {
    it("requires a value above zero by default", () => {
      expect(validateMoneyInput("0")).toEqual({
        error: "Amount must be greater than zero.",
      });
      expect(validateMoneyInput("0.01")).toEqual({ paise: 1 });
    });

    it("allows zero where the field is legitimately zero", () => {
      expect(validateMoneyInput("0", { allowZero: true })).toEqual({ paise: 0 });
    });

    it("surfaces the format problem as a message", () => {
      expect(validateMoneyInput("1.234")).toEqual({
        error: "Use a number with at most two decimal places.",
      });
    });
  });
});