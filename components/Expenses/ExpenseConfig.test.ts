import { validateForm } from "@/helpers/recordForm";
import { EXPENSE_FIELDS } from "@/components/Expenses/ExpenseConfig";
import { INSTALLMENT_TYPE_OPTIONS, PAYMENT_MODE_OPTIONS } from "@/constants/records";

const MINIMAL_EXPENSE = {
  title: "Weekly groceries",
  amount: "2450",
  date: "2026-10-05",
  category: "food",
  paymentMode: "upi",
};

describe("expense installments", () => {
  it("offers installment as a category", () => {
    const categoryField = EXPENSE_FIELDS.find((field) => field.name === "category");

    expect(categoryField?.kind).toBe("select");
    expect(
      categoryField?.kind === "select" &&
        categoryField.options.some((option) => option.value === "installment")
    ).toBe(true);
  });

  it("offers NACH as a payment mode", () => {
    expect(PAYMENT_MODE_OPTIONS.map((option) => option.value)).toContain("nach");
  });

  it("hides the loan type until installment is chosen", () => {
    const loanTypeField = EXPENSE_FIELDS.find((field) => field.name === "installmentType");

    expect(loanTypeField?.visibleWhen).toEqual({ name: "category", equals: "installment" });
    expect(validateForm(EXPENSE_FIELDS, MINIMAL_EXPENSE).installmentType).toBeUndefined();
  });

  it("requires a loan type once installment is chosen", () => {
    const errors = validateForm(EXPENSE_FIELDS, { ...MINIMAL_EXPENSE, category: "installment" });

    expect(errors.installmentType).toMatch(/required/i);
  });

  it("accepts an installment with a loan type", () => {
    const errors = validateForm(EXPENSE_FIELDS, {
      ...MINIMAL_EXPENSE,
      category: "installment",
      installmentType: "car",
    });

    expect(errors.installmentType).toBeUndefined();
  });

  it("offers the loan types the API accepts", () => {
    const values = INSTALLMENT_TYPE_OPTIONS.map((option) => option.value);

    expect(values).toEqual(
      expect.arrayContaining(["home", "car", "personal", "gold", "education", "business"])
    );
  });
});