import { render } from "@testing-library/react";
import { expenseColumns } from "@/components/Expenses/ExpenseConfig";
import { ExpenseCategory, InstallmentType } from "@/types/FinanceTypes";
import type { ResolvedExpense } from "@/components/Expenses/useLinkedExpenseFigures";
import type { Expense } from "@/types/FinanceTypes";

/**
 * A linked expense as the API returns it: every derived field `null`, because the loan owns
 * them. Built whole so a test cannot pass by reading a field that happens to be absent.
 */
const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: "expense-1",
  title: "HDFC Bank instalment",
  amount: null,
  date: "2026-06-01",
  category: null,
  installmentType: null,
  loanId: "loan-1",
  paymentMode: "upi",
  destination: "bank_account",
  merchant: null,
  reason: null,
  reference: null,
  isEssential: true,
  isRecurring: true,
  recurrenceFrequency: "monthly",
  notes: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

/** What `useLinkedExpenseFigures` resolves a linked expense to. */
const linked = (overrides: Partial<ResolvedExpense> = {}): ResolvedExpense => ({
  amount: 41_822_00,
  category: ExpenseCategory.INSTALLMENT,
  installmentType: InstallmentType.HOME,
  lender: "HDFC Bank",
  isImported: true,
  ...overrides,
});

const cellText = (key: string, subject: Expense): string => {
  const column = expenseColumns(() => linked()).find(
    (entry) => entry.key === key
  );

  if (!column) {
    throw new Error(`no column keyed ${key}`);
  }

  const { container } = render(<>{column.render(subject)}</>);

  return container.textContent ?? "";
};

describe("a linked expense in the table", () => {
  it("shows the instalment as its amount", () => {
    /*
     * The whole point of the link. The record holds no amount at all, so if this cell reads
     * from the record it shows a dash — which is what it did while the calculation lookup was
     * keyed by the wrong id.
     */
    expect(expense().amount).toBeNull();
    expect(cellText("amount", expense())).toContain("41,822");
  });

  it("shows Instalment as its category", () => {
    expect(expense().category).toBeNull();
    expect(cellText("category", expense())).toBe("Installment");
  });

  it("names the lender, since the title alone does not say whose", () => {
    expect(cellText("title", expense())).toContain("HDFC Bank");
  });

  it("shows a dash rather than a zero when the figure cannot be read", () => {
    const column = expenseColumns(() =>
      linked({ amount: null, category: null })
    );
    const amount = column.find((entry) => entry.key === "amount");

    const { container } = render(<>{amount?.render(expense())}</>);

    // 0 would read as an expense that cost nothing, which is a different and wrong claim from
    // one whose loan could not be found.
    expect(container.textContent).toBe("-");
  });

  it("still has no separate column for the loan's type", () => {
    /*
     * Category already says "Instalment" and the name cell says which loan, so a third column
     * restating a loan type was the same fact twice.
     */
    expect(expenseColumns(() => linked()).some((c) => c.key === "installmentType")).toBe(
      false
    );
  });

  it("leaves a hand-recorded expense showing its own figures", () => {
    const column = expenseColumns(() => ({
      amount: 245_000,
      category: ExpenseCategory.FOOD,
      installmentType: null,
      lender: null,
      isImported: false,
    }));
    const plain = expense({
      loanId: null,
      amount: 245_000,
      category: ExpenseCategory.FOOD,
    });

    const amountCell = column.find((c) => c.key === "amount");
    const categoryCell = column.find((c) => c.key === "category");

    const amount = render(<>{amountCell?.render(plain)}</>);
    const category = render(<>{categoryCell?.render(plain)}</>);

    expect(amount.container.textContent).toContain("2,450");
    expect(category.container.textContent).toBe("Food");
  });
});