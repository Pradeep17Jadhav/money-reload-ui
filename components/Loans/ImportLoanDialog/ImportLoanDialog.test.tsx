import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImportLoanDialog from "@/components/Loans/ImportLoanDialog/ImportLoanDialog";
import { useAuth } from "@/contexts/authContext";
import { getCalculationsByIds, listCalculations } from "@/services/loan/calculations";
import { createLoan, listLoans, updateLoan } from "@/services/finance/records";
import {
  CalculationType,
} from "@/types/Loan/CalculationTypes";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";
import {
  InterestType,
  LoanStatus,
  LoanType,
} from "@/types/FinanceTypes";
import type { Loan } from "@/types/FinanceTypes";

jest.mock("@/contexts/authContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/loan/calculations", () => ({
  listCalculations: jest.fn(),
  getCalculationsByIds: jest.fn(),
}));
jest.mock("@/services/finance/records", () => ({
  createLoan: jest.fn(),
  updateLoan: jest.fn(),
  listLoans: jest.fn(),
}));

const mockUseAuth = useAuth as unknown as jest.Mock;
const mockListCalculations = listCalculations as jest.Mock;
const mockGetCalculationsByIds = getCalculationsByIds as jest.Mock;
const mockCreateLoan = createLoan as jest.Mock;
const mockUpdateLoan = updateLoan as jest.Mock;
const mockListLoans = listLoans as jest.Mock;

const CALCULATION_ID = "6ac5ff3d311ac3f725d43a6d";
const OTHER_CALCULATION_ID = "7bd6ff3d311ac3f725d43a6e";

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
    startMonth: "2026-10",
  },
  prepayments: [],
  monthChanges: [],
  createdAt: "2026-10-07T08:13:49.103Z",
  updatedAt: "2026-10-07T08:13:49.103Z",
  ...overrides,
});

/**
 * An imported loan, exactly as the API returns one: every derived figure `null`, because the
 * calculation owns them.
 */
const importedLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "loan-1",
  title: "Home loan",
  lender: "HDFC Bank",
  loanType: LoanType.HOME,
  principal: null,
  interestRate: null,
  interestType: InterestType.REDUCING_BALANCE,
  startDate: "2026-10-01",
  endDate: null,
  emiAmount: null,
  emiDay: null,
  tenureMonths: null,
  undisbursedAmount: 1_500_000,
  loanCalculationId: CALCULATION_ID,
  status: LoanStatus.ACTIVE,
  purpose: "Home",
  reference: "ACC-1",
  notes: "Fixed until 2031",
  createdAt: "2026-10-07T08:13:49.103Z",
  updatedAt: "2026-10-07T08:13:49.103Z",
  deletedAt: null,
  ...overrides,
});

const renderDialog = (loan: Loan | null = null) => {
  const onClose = jest.fn();
  const onSaved = jest.fn();

  render(
    <ImportLoanDialog
      open
      loan={loan}
      onClose={onClose}
      onSaved={onSaved}
    />
  );

  return { user: userEvent.setup(), onClose, onSaved };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ authorisedRequest: jest.fn() });
  mockListCalculations.mockResolvedValue({ items: [calculation()], meta: {} });
  // Nothing imported yet, so every calculation is on offer by default.
  mockListLoans.mockResolvedValue({ items: [], meta: {} });
  mockGetCalculationsByIds.mockResolvedValue({
    [CALCULATION_ID]: calculation(),
  });
  mockCreateLoan.mockResolvedValue({});
  mockUpdateLoan.mockResolvedValue({});
});

describe("editing an imported loan", () => {
  it("asks for the same fields the import dialog asks for", async () => {
    renderDialog(importedLoan());

    // Title, lender, type, status, purpose, reference, notes, undisbursed.
    expect(await screen.findByTestId("import-title")).toHaveValue("Home loan");
    expect(screen.getByTestId("import-lender")).toHaveValue("HDFC Bank");
    expect(screen.getByTestId("import-reference")).toHaveValue("ACC-1");
    expect(screen.getByTestId("import-notes")).toHaveValue("Fixed until 2031");
    expect(screen.getByTestId("import-undisbursed")).toHaveValue("15000");
  });

  it("asks for none of the fields the calculation owns", () => {
    const { container } = render(
      <ImportLoanDialog open loan={importedLoan()} onClose={jest.fn()} onSaved={jest.fn()} />
    );

    const text = container.textContent ?? "";

    /*
     * Every one of these is null on the record, so the generic edit form would have shown a
     * row of empty boxes for the only fields an imported loan actually has figures for.
     */
    for (const label of [
      "principal",
      "interest rate",
      "interest type",
      "start date",
      "end date",
      "EMI amount",
      "EMI day",
      "tenure (months)",
    ]) {
      expect(text.toLowerCase()).not.toContain(label);
    }
  });

  it("does not offer a calculation to swap in", async () => {
    renderDialog(importedLoan());

    await waitFor(() => {
      expect(mockGetCalculationsByIds).toHaveBeenCalled();
    });

    /*
     * Re-pointing a loan at a different scenario would silently restate every figure on it.
     * That is not something to do by accident while renaming it.
     */
    expect(screen.queryByTestId("import-calculation-select")).toBeNull();
    // Exactly one calculation read — not the user's whole list.
    expect(mockListCalculations).not.toHaveBeenCalled();
    /*
     * Nor the loans: the dropdown is gone, so there is nothing to hold back, and an edit reads
     * only the one scenario it needs.
     */
    expect(mockListLoans).not.toHaveBeenCalled();
  });

  it("shows the calculation's figures read-only", async () => {
    renderDialog(importedLoan());

    const panel = await screen.findByTestId("import-derived");

    expect(within(panel).getByText(/amount disbursed/i)).toBeInTheDocument();
    expect(within(panel).getByText(/rate of interest/i)).toBeInTheDocument();
    expect(within(panel).getByText(/^EMI$/i)).toBeInTheDocument();
  });

  it("quotes the rate to two places, as the loans table does", async () => {
    mockGetCalculationsByIds.mockResolvedValue({
      [CALCULATION_ID]: calculation({
        loan: { ...calculation().loan, rateOfInterest: 8.5 },
      }),
    });

    renderDialog(importedLoan());

    const panel = await screen.findByTestId("import-derived");

    /*
     * Interpolated raw, this panel read `8.5%` while the loans table — which goes through
     * `formatPercent` — read `8.50%`, so the same rate was quoted at two precisions on two
     * screens of the same page.
     */
    expect(within(panel).getByText("8.50%")).toBeInTheDocument();
  });

  it("sends only the user's own fields, never the derived ones", async () => {
    const { user, onSaved } = renderDialog(importedLoan());

    await screen.findByTestId("import-title");
    await user.clear(screen.getByTestId("import-title"));
    await user.type(screen.getByTestId("import-title"), "Home loan 2023");
    await user.click(screen.getByTestId("import-save"));

    await waitFor(() => {
      expect(mockUpdateLoan).toHaveBeenCalled();
    });

    const [, id, payload] = mockUpdateLoan.mock.calls[0];

    expect(id).toBe("loan-1");
    expect(payload).toEqual({
      title: "Home loan 2023",
      lender: "HDFC Bank",
      loanType: LoanType.HOME,
      status: LoanStatus.ACTIVE,
      purpose: "Home",
      reference: "ACC-1",
      notes: "Fixed until 2031",
      undisbursedAmount: 1_500_000,
    });

    /*
     * The API refuses every one of these on a linked loan, and refusing to send them is not
     * an optimisation — it is the reason the stored record can never disagree with the
     * calculation it points at. `loanCalculationId` and `startDate` are absent too, so PATCH
     * leaves them alone.
     */
    for (const key of [
      "principal",
      "interestRate",
      "endDate",
      "emiAmount",
      "tenureMonths",
      "loanCalculationId",
      "startDate",
    ]) {
      expect(payload).not.toHaveProperty(key);
    }

    expect(onSaved).toHaveBeenCalled();
  });

  it("clears an optional field the user empties", async () => {
    const { user } = renderDialog(importedLoan());

    await screen.findByTestId("import-notes");
    await user.clear(screen.getByTestId("import-notes"));
    await user.click(screen.getByTestId("import-save"));

    await waitFor(() => {
      expect(mockUpdateLoan).toHaveBeenCalled();
    });

    // Null, not omitted: omitting would leave the old value sitting there untouched.
    expect(mockUpdateLoan.mock.calls[0][2].notes).toBeNull();
  });

  it("says so when the calculation cannot be read, and still allows an edit", async () => {
    mockGetCalculationsByIds.mockResolvedValue({});

    const { user, onSaved } = renderDialog(importedLoan());

    // A missing scenario is not a broken loan — its own fields are still editable.
    expect(await screen.findByTestId("import-calculation-missing")).toBeInTheDocument();

    await user.click(screen.getByTestId("import-save"));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("still insists on a title and a lender", async () => {
    const { user, onSaved } = renderDialog(importedLoan({ title: "", lender: "" }));

    await screen.findByTestId("import-title");
    await user.click(screen.getByTestId("import-save"));

    expect(onSaved).not.toHaveBeenCalled();
    expect(mockUpdateLoan).not.toHaveBeenCalled();
  });
});

describe("importing a loan", () => {
  it("still offers the calculation to pick, and creates on save", async () => {
    const { user, onSaved } = renderDialog();

    await waitFor(() => {
      expect(mockListCalculations).toHaveBeenCalled();
    });

    expect(screen.getByTestId("import-calculation-select")).toBeInTheDocument();

    // The testid sits on MUI's hidden input, which cannot be clicked, and this dialog has
    // several comboboxes — so the label is what identifies the one to press.
    await user.click(screen.getByLabelText("Saved calculation"));
    await user.click(await screen.findByRole("option", { name: "Best case" }));
    await user.type(screen.getByTestId("import-title"), "Home loan");
    await user.type(screen.getByTestId("import-lender"), "HDFC Bank");
    await user.click(screen.getByTestId("import-save"));

    await waitFor(() => {
      expect(mockCreateLoan).toHaveBeenCalled();
    });

    // createLoan takes (request, payload) — the request function is the first argument.
const [, payload] = mockCreateLoan.mock.calls[0];

    // The calculation reference and its start month are what a create adds on top of the
    // fields an edit sends; both are read from the calculation rather than typed.
    expect(payload.loanCalculationId).toBe(CALCULATION_ID);
    expect(payload.startDate).toBe("2026-10-01");
    expect(mockUpdateLoan).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("calculations already imported", () => {
  const aLoanFrom = (calculationId: string | null): Loan =>
    importedLoan({ id: `loan-${calculationId ?? "plain"}`, loanCalculationId: calculationId });

  const openTheDropdown = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByLabelText("Saved calculation"));
  };

  it("holds back a scenario a loan was already imported from", async () => {
    mockListCalculations.mockResolvedValue({
      items: [
        calculation(),
        calculation({ id: OTHER_CALCULATION_ID, name: "Conservative case" }),
      ],
      meta: {},
    });
    mockListLoans.mockResolvedValue({
      items: [aLoanFrom(CALCULATION_ID)],
      meta: {},
    });

    const { user } = renderDialog();

    await waitFor(() => {
      expect(mockListLoans).toHaveBeenCalled();
    });

    await openTheDropdown(user);

    expect(screen.queryByRole("option", { name: "Best case" })).not.toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Conservative case" })).toBeInTheDocument();
  });

  it("leaves a scenario alone when the loan it came from is not imported", async () => {
    /*
     * The other way round, and the one that would be easy to get wrong: a recorded loan has no
     * scenario at all, which must not be mistaken for "this scenario is taken".
     */
    mockListLoans.mockResolvedValue({
      items: [aLoanFrom(null), aLoanFrom("")],
      meta: {},
    });

    const { user } = renderDialog();

    await waitFor(() => {
      expect(mockListLoans).toHaveBeenCalled();
    });

    await openTheDropdown(user);

    expect(await screen.findByRole("option", { name: "Best case" })).toBeInTheDocument();
  });

  it("says so when every scenario has already been imported", async () => {
    mockListLoans.mockResolvedValue({
      items: [aLoanFrom(CALCULATION_ID)],
      meta: {},
    });

    renderDialog();

    /*
     * A different message from "you have no saved calculations". One is a reason to go and save
     * one; the other is a reason to stop, and telling the user to go and save a calculation
     * they already have would send them off to duplicate a scenario.
     */
    expect(
      await screen.findByText(/every saved calculation has already been imported/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/no saved calculations yet/i)).not.toBeInTheDocument();
  });

  it("cannot save a scenario it is not offering", async () => {
    mockListCalculations.mockResolvedValue({
      items: [calculation(), calculation({ id: OTHER_CALCULATION_ID, name: "Conservative case" })],
      meta: {},
    });
    mockListLoans.mockResolvedValue({
      items: [aLoanFrom(CALCULATION_ID), aLoanFrom(OTHER_CALCULATION_ID)],
      meta: {},
    });

    const { user } = renderDialog();

    await waitFor(() => {
      expect(mockListLoans).toHaveBeenCalled();
    });

    await openTheDropdown(user);

    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    // Nothing to import, so nothing to save — rather than a save that quietly posts a
    // duplicate the dropdown is pretending does not exist.
    expect(screen.getByTestId("import-save")).toBeDisabled();
    await user.click(screen.getByTestId("import-save"));

    expect(mockCreateLoan).not.toHaveBeenCalled();
  });
});