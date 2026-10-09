import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImportIncomeTaxDialog from "@/components/Income/ImportIncomeTaxDialog/ImportIncomeTaxDialog";
import { useAuth } from "@/contexts/authContext";
import {
  createIncomeTaxCalculation,
  getIncomeTaxCalculationsByIds,
  listIncomeTaxCalculations,
} from "@/services/incomeTax/calculations";
import { createIncome, listIncomes, updateIncome } from "@/services/finance/records";
import type { SavedIncomeTaxCalculation } from "@/types/IncomeTax/CalculationTypes";
import {
  Destination,
  IncomeCategory,
  PaymentMode,
  RecurrenceFrequency,
} from "@/types/FinanceTypes";
import type { Income } from "@/types/FinanceTypes";
import type { Budget } from "@/types/ConfigTypes";

jest.mock("@/contexts/authContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/incomeTax/calculations", () => ({
  listIncomeTaxCalculations: jest.fn(),
  getIncomeTaxCalculationsByIds: jest.fn(),
  createIncomeTaxCalculation: jest.fn(),
}));
jest.mock("@/services/finance/records", () => ({
  createIncome: jest.fn(),
  updateIncome: jest.fn(),
  listIncomes: jest.fn(),
}));

const mockUseAuth = useAuth as unknown as jest.Mock;
const mockListCalculations = listIncomeTaxCalculations as jest.Mock;
const mockGetByIds = getIncomeTaxCalculationsByIds as jest.Mock;
const mockCreateCalculation = createIncomeTaxCalculation as jest.Mock;
const mockCreateIncome = createIncome as jest.Mock;
const mockUpdateIncome = updateIncome as jest.Mock;
const mockListIncomes = listIncomes as jest.Mock;

const SCENARIO_ID = "6ac5ff3d311ac3f725d43a6d";

const scenario = (
  overrides: Partial<SavedIncomeTaxCalculation> = {}
): SavedIncomeTaxCalculation => ({
  id: SCENARIO_ID,
  name: "FY25-26 salaried",
  description: null,
  assessmentYear: "2026-27",
  financialYear: "2025-26",
  regime: "OLD",
  annualIncome: 150_000_000,
  useStandardDeduction: true,
  additionalIncome: [],
  createdAt: "2026-10-07T08:13:49.103Z",
  updatedAt: "2026-10-07T08:13:49.103Z",
  ...overrides,
});

const budget: Budget = {
  year: 2026,
  financialYear: "2025-26",
  assessmentYear: "2026-27",
  name: "Budget 2026",
  regime: "Old",
  applyMarginalRelief: false,
  rebate: { amount: 700_000, type: "up to" },
  standardDeduction: { amount: 75_000, type: "salaried" },
  taxes: [],
  slabs: [
    { incomeFrom: 0, incomeTo: 500_000, taxInPercent: 0 },
    { incomeFrom: 500_000, incomeTo: 1_000_000, taxInPercent: 5 },
    { incomeFrom: 1_000_000, incomeTo: 2_500_000, taxInPercent: 20 },
  ],
};

/**
 * An imported income: no amount and no tax of its own, because the scenario owns both.
 */
const importedIncome = (overrides: Partial<Income> = {}): Income => ({
  id: "income-1",
  source: "Acme Corp",
  amount: null,
  date: "2026-04-01",
  category: IncomeCategory.SALARY,
  paymentMode: PaymentMode.NEFT,
  payer: null,
  destination: Destination.BANK_ACCOUNT,
  reason: null,
  reference: null,
  taxPaid: null,
  incomeTaxCalculationId: SCENARIO_ID,
  isRecurring: true,
  recurrenceFrequency: RecurrenceFrequency.MONTHLY,
  notes: null,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

const renderDialog = (income: Income | null = null) => {
  const onClose = jest.fn();
  const onSaved = jest.fn();

  render(
    <ImportIncomeTaxDialog
      open
      income={income}
      budgets={[budget]}
      onClose={onClose}
      onSaved={onSaved}
    />
  );

  return { user: userEvent.setup(), onClose, onSaved };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ authorisedRequest: jest.fn(), isSignedIn: true });
  mockListCalculations.mockResolvedValue({ items: [scenario()], meta: {} });
  mockGetByIds.mockResolvedValue({ [SCENARIO_ID]: scenario() });
  mockListIncomes.mockResolvedValue({ items: [], meta: {} });
  mockCreateIncome.mockResolvedValue({});
  mockUpdateIncome.mockResolvedValue({});
});

describe("importing an income", () => {
  it("shows the scenario's figures, and asks for none of them", async () => {
    const { user } = renderDialog();

    await user.click(screen.getByLabelText("Saved calculation"));
    await user.click(await screen.findByRole("option", { name: /FY25-26 salaried/ }));

    const panel = await screen.findByTestId("import-income-tax-derived");

    expect(within(panel).getByText(/annual income/i)).toBeInTheDocument();
    expect(within(panel).getByText(/tax for the year/i)).toBeInTheDocument();

    /*
     * The point of the whole dialog. A box asking for either would be asking the user to retype
     * a number the import is about to supply — and a stored copy could never be told from the
     * real one on a later read.
     */
    expect(screen.queryByTestId("import-income-amount")).toBeNull();
    expect(screen.queryByTestId("import-income-tax-paid")).toBeNull();
  });

  it("sends the user's own fields and the reference, and never the figures", async () => {
    const { user, onSaved } = renderDialog();

    await user.click(screen.getByLabelText("Saved calculation"));
    await user.click(await screen.findByRole("option", { name: /FY25-26 salaried/ }));

    await user.type(screen.getByTestId("import-income-source"), "Acme Corp");
    // By the label, not the testid: the testid sits on MUI's hidden input, which cannot be
    // clicked, and this dialog has several comboboxes.
    await user.click(screen.getByLabelText(/payment mode/i));
    await user.click(await screen.findByRole("option", { name: /NEFT/i }));
    await user.click(screen.getByTestId("import-income-save"));

    await waitFor(() => {
      expect(mockCreateIncome).toHaveBeenCalled();
    });

    const [, payload] = mockCreateIncome.mock.calls[0];

    expect(payload).toMatchObject({
      source: "Acme Corp",
      incomeTaxCalculationId: SCENARIO_ID,
    });

    // The API refuses both of these beside a reference, so sending either would be rejected.
    expect(payload).not.toHaveProperty("amount");
    expect(payload).not.toHaveProperty("taxPaid");
    expect(onSaved).toHaveBeenCalled();
  });

  it("holds back a scenario an income already stands for", async () => {
    mockListIncomes.mockResolvedValue({
      items: [importedIncome()],
      meta: {},
    });

    const { user } = renderDialog();

    await waitFor(() => {
      expect(mockListIncomes).toHaveBeenCalled();
    });

    await user.click(screen.getByLabelText("Saved calculation"));

    // A second income off one scenario is the same annual figure filed twice.
    expect(screen.queryByRole("option", { name: /FY25-26 salaried/ })).not.toBeInTheDocument();
    expect(
      screen.getByTestId("import-income-tax-no-scenarios")
    ).toHaveTextContent(/already been imported/i);
  });

  it("still insists on a source and a payment mode", async () => {
    const { user, onSaved } = renderDialog();

    await user.click(screen.getByLabelText("Saved calculation"));
    await user.click(await screen.findByRole("option", { name: /FY25-26 salaried/ }));
    await user.click(screen.getByTestId("import-income-save"));

    expect(onSaved).not.toHaveBeenCalled();
    expect(mockCreateIncome).not.toHaveBeenCalled();
  });
});

describe("editing an imported income", () => {
  it("asks for the same fields the import dialog asks for", async () => {
    renderDialog(importedIncome());

    expect(await screen.findByTestId("import-income-source")).toHaveValue("Acme Corp");
    expect(screen.getByTestId("import-income-reference")).toHaveValue("");
    expect(screen.getByTestId("import-income-notes")).toHaveValue("");
  });

  it("asks for none of the fields the scenario owns", () => {
    const { container } = render(
      <ImportIncomeTaxDialog
        open
        income={importedIncome()}
        budgets={[budget]}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );

    const text = container.textContent ?? "";

    // Every one of these is null on the record, so the generic edit form would have shown a row
    // of empty boxes for the only figures an imported income actually has.
    for (const label of ["amount", "tax paid"]) {
      expect(text.toLowerCase()).not.toContain(label);
    }
  });

  it("offers no scenario to swap in", async () => {
    renderDialog(importedIncome());

    await waitFor(() => {
      expect(mockGetByIds).toHaveBeenCalled();
    });

    /*
     * Re-pointing an income at a different scenario would silently restate both its amount and
     * its tax. That is not something to do by accident while renaming it.
     */
    expect(screen.queryByTestId("import-income-tax-select")).toBeNull();
    expect(mockListCalculations).not.toHaveBeenCalled();
  });

  it("sends only the user’s own fields on save, never the figures", async () => {
    const { user, onSaved } = renderDialog(importedIncome());

    await screen.findByTestId("import-income-source");
    await user.clear(screen.getByTestId("import-income-source"));
    await user.type(screen.getByTestId("import-income-source"), "Acme Corp Ltd");
    await user.click(screen.getByTestId("import-income-save"));

    await waitFor(() => {
      expect(mockUpdateIncome).toHaveBeenCalled();
    });

    const [, , payload] = mockUpdateIncome.mock.calls[0];

    expect(payload).toEqual({
      source: "Acme Corp Ltd",
      date: "2026-04-01",
      category: IncomeCategory.SALARY,
      paymentMode: PaymentMode.NEFT,
      payer: null,
      reference: null,
      notes: null,
    });

    /*
     * `incomeTaxCalculationId` is absent too, so PATCH leaves the link alone. The record keeps
     * pointing at the same scenario, and its amount and tax keep being read from it.
     */
    for (const key of ["amount", "taxPaid", "incomeTaxCalculationId"]) {
      expect(payload).not.toHaveProperty(key);
    }
    expect(onSaved).toHaveBeenCalled();
  });

  it("says so when the scenario cannot be read, and still allows an edit", async () => {
    mockGetByIds.mockResolvedValue({});

    const { user, onSaved } = renderDialog(importedIncome());

    // A missing scenario is not a broken income — its own fields are still editable.
    expect(await screen.findByTestId("import-income-tax-missing")).toBeInTheDocument();

    await user.click(screen.getByTestId("import-income-save"));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("says so when the scenario’s year is no longer in the config", async () => {
    render(
      <ImportIncomeTaxDialog
        open
        income={importedIncome()}
        // Nothing matching AY 2026 at all, so the projection cannot be made. The scenario reads
        // fine — it is the budget behind it that has gone.
        budgets={[]}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );

    // The income still works: its own fields are editable, and saving them does not touch the
    // link.
    expect(await screen.findByTestId("import-income-tax-missing")).toBeInTheDocument();
  });
});