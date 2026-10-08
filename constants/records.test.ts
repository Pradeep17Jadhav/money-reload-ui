import {
  labelForEnumValue,
  PAYMENT_MODE_OPTIONS,
  sortOptions,
} from "@/constants/records";
import { PaymentMode } from "@/types/FinanceTypes";

const labelFor = (value: string) =>
  PAYMENT_MODE_OPTIONS.find((option) => option.value === value)?.label;

describe("enum labels", () => {
  describe("payment modes", () => {
    it("keeps an acronym upper case", () => {
      expect(labelFor("upi")).toBe("UPI");
      expect(labelFor("neft")).toBe("NEFT");
      expect(labelFor("imps")).toBe("IMPS");
    });

    it("spells out a demand draft rather than showing the abbreviation", () => {
      expect(labelFor("dd")).toBe("Demand draft");
      expect(PaymentMode.DD).toBe("dd");
    });

    it("still humanises the wordy values", () => {
      expect(labelFor("net_banking")).toBe("Net banking");
      expect(labelFor("cash")).toBe("Cash");
    });

    it("leaves the wire value untouched", () => {
      // The label is for people; the value is what goes in the body.
      expect(PAYMENT_MODE_OPTIONS.find((option) => option.label === "UPI")?.value).toBe("upi");
    });
  });

  it("applies the same labels in table cells", () => {
    expect(labelForEnumValue("upi")).toBe("UPI");
    expect(labelForEnumValue("dd")).toBe("Demand draft");
    expect(labelForEnumValue("loan_repayment")).toBe("Loan repayment");
  });

  it("labels sort keys through the same path", () => {
    expect(sortOptions(["net_banking"]).find((option) => option.value === "net_banking")?.label).toBe(
      "Net banking"
    );
  });
});