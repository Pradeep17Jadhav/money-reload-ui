import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SavedCalculationsSelect from "@/components/Loan/SavedCalculationsSelect/SavedCalculationsSelect";
import {
  SavedCalculationsProvider,
  useSavedCalculationsProvider,
} from "@/contexts/loan/savedCalculationsContext";
import { useAuth } from "@/contexts/authContext";
import { listCalculations } from "@/services/loan/calculations";
import { CALCULATIONS_LIST_LIMIT } from "@/constants/calculations";
import {
  CalculationPrepaymentInterval,
  CalculationType,
} from "@/types/Loan/CalculationTypes";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";
import { createApiError } from "@/tests/factories/authFactories";
import { AuthErrorCode } from "@/types/AuthTypes";

jest.mock("@/contexts/authContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/loan/calculations", () => ({ listCalculations: jest.fn() }));

const mockUseAuth = useAuth as unknown as jest.Mock;
const mockListCalculations = listCalculations as jest.Mock;

const meta = {
  page: 1,
  limit: CALCULATIONS_LIST_LIMIT,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const calculation = (
  overrides: Partial<SavedLoanCalculation> = {}
): SavedLoanCalculation => ({
  id: "calculation-1",
  name: "Best case",
  description: "Prepay 1L a year.",
  calculationType: CalculationType.HOME,
  currency: "INR",
  loan: {
    loanAmount: 500_000_000,
    rateOfInterest: 8,
    tenure: { years: 20, months: 0 },
    startMonth: "2026-10",
  },
  prepayments: [
    {
      amount: 10_000_000,
      startMonth: "2027-04",
      interval: CalculationPrepaymentInterval.ANNUALLY,
    },
  ],
  monthChanges: [{ monthIndex: 36, rateOfInterest: 8.5 }],
  createdAt: "2026-10-07T08:13:49.103Z",
  updatedAt: "2026-10-07T08:13:49.103Z",
  ...overrides,
});

const signIn = (authorisedRequest = jest.fn()) => {
  mockUseAuth.mockReturnValue({ isSignedIn: true, authorisedRequest });
  return authorisedRequest;
};

/**
 * Reads the pending scenario straight out of the provider — the same value the
 * calculator reads — so the assertion is about what the dropdown handed over rather
 * than about how the select happens to keep its own state.
 */
const Probe = () => {
  const { pendingCalculation } = useSavedCalculationsProvider();

  return (
    <div>
      <span data-testid="pending-id">{pendingCalculation?.id ?? "none"}</span>
      <span data-testid="pending-loan">
        {pendingCalculation?.loan.loanAmount ?? "none"}
      </span>
    </div>
  );
};



/** `extra` is passed as an element, so a caller writes `<Probe />` rather than `Probe()`. */
const renderSelect = (extra?: React.ReactElement) =>
  render(
    <SavedCalculationsProvider>
      {extra}
      <SavedCalculationsSelect />
    </SavedCalculationsProvider>
  );

describe("SavedCalculationsSelect", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("is not rendered for an anonymous visitor, who has nothing saved", () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, authorisedRequest: jest.fn() });
    mockListCalculations.mockResolvedValue({ items: [], meta });

    renderSelect();

    expect(screen.queryByTestId("saved-calculations")).not.toBeInTheDocument();
  });

  it("asks for no request at all when signed out", async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, authorisedRequest: jest.fn() });

    renderSelect();

    await waitFor(() => expect(mockListCalculations).not.toHaveBeenCalled());
  });

  it("reads through the authorised request, so the list is the caller's own", async () => {
    const authorisedRequest = signIn();
    mockListCalculations.mockResolvedValue({ items: [], meta });

    renderSelect();

    await waitFor(() =>
      expect(mockListCalculations).toHaveBeenCalledWith(authorisedRequest)
    );
  });

  it("offers each saved calculation by name", async () => {
    const user = userEvent.setup();
    signIn();
    mockListCalculations.mockResolvedValue({
      items: [
        calculation({ id: "calculation-1", name: "Best case" }),
        calculation({ id: "calculation-2", name: "Rate hike scenario" }),
      ],
      meta,
    });

    renderSelect();
    await user.click(await screen.findByRole("combobox"));

    expect(
      await screen.findByRole("option", { name: "Best case" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Rate hike scenario" })
    ).toBeInTheDocument();
  });

  it("holds the chosen calculation once picked", async () => {
    const user = userEvent.setup();
    signIn();
    mockListCalculations.mockResolvedValue({
      items: [calculation({ id: "calculation-1", name: "Best case" })],
      meta,
    });

    renderSelect();
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Best case" }));

    expect(screen.getByRole("combobox")).toHaveTextContent("Best case");
  });

  it("hands the whole calculation over, so the calculator needs no second read", async () => {
    const user = userEvent.setup();
    signIn();
    const saved = calculation({ id: "calculation-1", name: "Best case" });
    mockListCalculations.mockResolvedValue({ items: [saved], meta });

    renderSelect(<Probe />);
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Best case" }));

    // The whole scenario, not just its id: applying it must not cost another request.
    expect(screen.getByTestId("pending-id")).toHaveTextContent("calculation-1");
    expect(screen.getByTestId("pending-loan")).toHaveTextContent("500000000");
    expect(mockListCalculations).toHaveBeenCalledTimes(1);
  });

  it("leaves a previously picked scenario in place when the placeholder is picked", async () => {
    const user = userEvent.setup();
    signIn();
    mockListCalculations.mockResolvedValue({
      items: [
        calculation({ id: "calculation-1", name: "Best case" }),
        calculation({ id: "calculation-2", name: "Rate hike" }),
      ],
      meta,
    });

    renderSelect(<Probe />);
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Best case" }));
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Rate hike" }));

    expect(screen.getByTestId("pending-id")).toHaveTextContent("calculation-2");
  });

  it("says so plainly when nothing has been saved yet", async () => {
    signIn();
    mockListCalculations.mockResolvedValue({ items: [], meta });

    renderSelect();

    const select = await screen.findByRole("combobox", {
      name: /saved calculations/i,
    });

    await waitFor(() =>
      expect(select).toHaveTextContent("No saved calculations yet")
    );
  });

  it("says the list could not be read rather than showing an empty dropdown", async () => {
    signIn();
    mockListCalculations.mockRejectedValue(
      createApiError(AuthErrorCode.DATABASE_UNAVAILABLE)
    );

    renderSelect();

    const select = await screen.findByRole("combobox", {
      name: /saved calculations/i,
    });

    await waitFor(() =>
      expect(select).toHaveTextContent("Could not load saved calculations")
    );
    // MUI marks a disabled Select with aria-disabled rather than the attribute.
    expect(select).toHaveAttribute("aria-disabled", "true");
  });
});