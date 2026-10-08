import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/authContext";
import { listLoans } from "@/services/finance/records";
import { getCalculationsByIds } from "@/services/loan/calculations";
import { useLinkedExpenseFigures } from "@/components/Expenses/useLinkedExpenseFigures";
import { CalculationType } from "@/types/Loan/CalculationTypes";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";
import {
  Destination,
  ExpenseCategory,
  InstallmentType,
  InterestType,
  LoanStatus,
  LoanType,
  PaymentMode,
  RecurrenceFrequency,
} from "@/types/FinanceTypes";
import type { Expense, Loan } from "@/types/FinanceTypes";

jest.mock("@/contexts/authContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/finance/records", () => ({ listLoans: jest.fn() }));
jest.mock("@/services/loan/calculations", () => ({ getCalculationsByIds: jest.fn() }));

const mockUseAuth = useAuth as unknown as jest.Mock;
const mockListLoans = listLoans as unknown as jest.Mock;
const mockGetCalculationsByIds = getCalculationsByIds as jest.Mock;

const CALCULATION_ID = "6ac5ff3d311ac3f725d43a6d";
const LOAN_ID = "6bc5ff3d311ac3f725d43a6d";

const calculation = (
  overrides: Partial<SavedLoanCalculation> = {}
): SavedLoanCalculation => ({
  id: CALCULATION_ID,
  name: "Best case",
  description: null,
  calculationType: CalculationType.HOME,
  currency: "INR",
  loan: {
    loanAmount: 500_000_000,
    rateOfInterest: 8,
    tenure: { years: 20, months: 0 },
    startMonth: "2024-01",
  },
  prepayments: [],
  monthChanges: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

/** A loan that stores its own instalment, with no calculation behind it. */
const plainLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: LOAN_ID,
  title: "Home loan",
  lender: "HDFC Bank",
  loanType: LoanType.HOME,
  principal: 500_000_000,
  interestRate: 8,
  interestType: InterestType.REDUCING_BALANCE,
  startDate: "2024-01-01",
  endDate: "2044-01-01",
  emiAmount: 41_822_00,
  emiDay: 5,
  tenureMonths: 240,
  undisbursedAmount: null,
  loanCalculationId: null,
  status: LoanStatus.ACTIVE,
  purpose: null,
  reference: null,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

/** An imported loan: no figures of its own, everything read from its calculation. */
const importedLoan = (overrides: Partial<Loan> = {}): Loan =>
  plainLoan({
    principal: null,
    interestRate: null,
    endDate: null,
    emiAmount: null,
    tenureMonths: null,
    loanCalculationId: CALCULATION_ID,
    ...overrides,
  });

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: "expense-1",
  title: "HDFC Bank instalment",
  amount: null,
  date: "2026-06-01",
  category: null,
  installmentType: null,
  loanId: LOAN_ID,
  paymentMode: PaymentMode.UPI,
  destination: Destination.BANK_ACCOUNT,
  merchant: null,
  reason: null,
  reference: null,
  isEssential: true,
  isRecurring: true,
  recurrenceFrequency: RecurrenceFrequency.MONTHLY,
  notes: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ authorisedRequest: jest.fn() });
  mockGetCalculationsByIds.mockResolvedValue({});
});

describe("resolving a linked expense", () => {
  it("reads the instalment off a loan that stores one", async () => {
    mockListLoans.mockResolvedValue({ items: [plainLoan()], meta: {} });

    const { result } = renderHook(() =>
      useLinkedExpenseFigures([expense()])
    );

    await waitFor(() => {
      expect(result.current.figuresFor(expense()).amount).toBe(41_822_00);
    });

    expect(result.current.unresolved).toBe(0);
  });

  it("files a linked expense as an instalment, whatever the record says", async () => {
    mockListLoans.mockResolvedValue({ items: [plainLoan()], meta: {} });

    const { result } = renderHook(() => useLinkedExpenseFigures([expense()]));

    await waitFor(() => {
      expect(result.current.figuresFor(expense()).amount).not.toBeNull();
    });

    // Null on the record, because the loan owns that too.
    expect(expense().category).toBeNull();
    expect(result.current.figuresFor(expense()).category).toBe(
      ExpenseCategory.INSTALLMENT
    );
    expect(result.current.figuresFor(expense()).installmentType).toBe(
      InstallmentType.HOME
    );
  });

  it("reads the instalment off a loan's calculation, at the expense's own month", async () => {
    mockListLoans.mockResolvedValue({ items: [importedLoan()], meta: {} });
    mockGetCalculationsByIds.mockResolvedValue({ [CALCULATION_ID]: calculation() });

    const { result } = renderHook(() => useLinkedExpenseFigures([expense()]));

    await waitFor(() => {
      expect(result.current.figuresFor(expense()).amount).toBeGreaterThan(0);
    });

    // Only the imported loan's calculation is read behind it, and by its own id —
    // not by the loan's.
    expect(mockGetCalculationsByIds.mock.calls[0][1]).toEqual([CALCULATION_ID]);
    expect(result.current.figuresFor(expense()).lender).toBe("HDFC Bank");
  });

  it("asks for the loans in one request, by id", async () => {
    mockListLoans.mockResolvedValue({ items: [plainLoan()], meta: {} });

    renderHook(() =>
      useLinkedExpenseFigures([
        expense({ id: "a", loanId: LOAN_ID }),
        expense({ id: "b", loanId: LOAN_ID }),
      ])
    );

    await waitFor(() => {
      expect(mockListLoans).toHaveBeenCalled();
    });

    // Two rows pointing at one loan is still one request.
    expect(mockListLoans).toHaveBeenCalledTimes(1);
    expect(mockListLoans.mock.calls[0][1]).toMatchObject({
      ids: [LOAN_ID],
      limit: 1,
    });
  });

  it("asks for nothing when no expense is linked", async () => {
    mockListLoans.mockResolvedValue({ items: [], meta: {} });

    const ordinary = expense({
      id: "ordinary",
      loanId: null,
      amount: 245_000,
      category: ExpenseCategory.FOOD,
    });

    const { result } = renderHook(() => useLinkedExpenseFigures([ordinary]));

    await waitFor(() => {
      expect(result.current.figuresFor(ordinary).amount).toBe(245_000);
    });

    // A page of ordinary expenses costs no extra request.
    expect(mockListLoans).not.toHaveBeenCalled();
    expect(result.current.figuresFor(ordinary).isImported).toBe(false);
  });

  it("leaves a hand-recorded expense answering for itself", async () => {
    mockListLoans.mockResolvedValue({ items: [], meta: {} });

    const plain = expense({
      id: "plain",
      loanId: null,
      amount: 245_000,
      category: ExpenseCategory.FOOD,
    });

    const { result } = renderHook(() => useLinkedExpenseFigures([plain]));

    await waitFor(() => {
      expect(result.current.figuresFor(plain).amount).toBe(245_000);
    });

    expect(result.current.figuresFor(plain).category).toBe(ExpenseCategory.FOOD);
  });

  it("reports a loan it cannot read, rather than showing a free expense", async () => {
    mockListLoans.mockResolvedValue({ items: [], meta: {} });

    const { result } = renderHook(() => useLinkedExpenseFigures([expense()]));

    await waitFor(() => {
      expect(result.current.unresolved).toBe(1);
    });

    // Null rather than 0: zero would read as an expense that cost nothing, which is a
    // different and wrong claim from one whose source could not be found.
    expect(result.current.figuresFor(expense()).amount).toBeNull();
  });

  it("reports a month the loan never had, as having no figure", async () => {
    mockListLoans.mockResolvedValue({ items: [importedLoan()], meta: {} });
    mockGetCalculationsByIds.mockResolvedValue({ [CALCULATION_ID]: calculation() });

    // Dated before the loan began. There was no instalment then.
    const early = expense({ date: "2020-01-01" });

    const { result } = renderHook(() => useLinkedExpenseFigures([early]));

    await waitFor(() => {
      expect(result.current.unresolved).toBe(1);
    });

    expect(result.current.figuresFor(early).amount).toBeNull();
  });
});