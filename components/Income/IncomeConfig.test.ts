import { validateForm } from "@/helpers/recordForm";
import { INCOME_FIELDS } from "@/components/Income/IncomeConfig";

/** Only what the API requires. */
const MINIMAL_INCOME = {
  source: "Acme Corp",
  amount: "85000",
  date: "2026-10-01",
  category: "salary",
  paymentMode: "neft",
};

describe("income form requirements", () => {
  it("needs nothing beyond source, amount, date, category and payment mode", () => {
    expect(validateForm(INCOME_FIELDS, MINIMAL_INCOME)).toEqual({});
  });

  it("does not require tax paid", () => {
    expect(validateForm(INCOME_FIELDS, MINIMAL_INCOME).taxPaid).toBeUndefined();
  });

  it("does not require a reference", () => {
    expect(validateForm(INCOME_FIELDS, MINIMAL_INCOME).reference).toBeUndefined();
  });

  it("accepts tax paid of zero, which is a real value", () => {
    expect(validateForm(INCOME_FIELDS, { ...MINIMAL_INCOME, taxPaid: "0" }).taxPaid).toBeUndefined();
  });

  it("accepts a tax paid that was filled in", () => {
    expect(
      validateForm(INCOME_FIELDS, { ...MINIMAL_INCOME, taxPaid: "4250" }).taxPaid
    ).toBeUndefined();
  });

  it("still rejects the fields the API does require", () => {
    const errors = validateForm(INCOME_FIELDS, { ...MINIMAL_INCOME, source: "", amount: "" });
    expect(errors.source).toBeDefined();
    expect(errors.amount).toBeDefined();
  });
});