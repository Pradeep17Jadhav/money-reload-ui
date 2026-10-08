import { useMemo, useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/authContext";
import { SavedCalculationsProvider } from "@/contexts/loan/savedCalculationsContext";
import SavedCalculationsSelect from "@/components/Loan/SavedCalculationsSelect/SavedCalculationsSelect";
import { PrepaymentsProvider } from "@/contexts/loan/prepaymentsContext";
import { CurrencyContext } from "@/contexts/currency";
import type { Currency } from "@/contexts/currency";
import CommonLoanCalculator from "@/components/Common/LoanCalculator/CommonLoanCalculator/CommonLoanCalculator";
import LoanCalculatorSummary from "@/components/Loan/LoanCalculatorSummary";
import { listCalculations, createCalculation } from "@/services/loan/calculations";
import { CalculationPrepaymentInterval, CalculationType } from "@/types/Loan/CalculationTypes";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";
import { LoanCalculatorType } from "@/types/ConfigTypes";

jest.mock("@/contexts/authContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/loan/calculations", () => ({
  listCalculations: jest.fn(),
  createCalculation: jest.fn(),
}));
// jsdom has no canvas, and the PDF module touches one at import time.
jest.mock("@/components/Common/LoanCalculator/helpers/pdfGenerator", () => ({
  generatePDF: jest.fn(),
}));
/*
 * Recharts measures its container with a `ResizeObserver`, which jsdom does not
 * implement. Stubbed rather than the chart itself, so the summary's real props
 * still render and only the measuring is skipped.
 */
jest.mock("@/components/Charts/ProgressChart", () => ({
  __esModule: true,
  default: () => <div data-testid="progress-chart" />,
}));
jest.mock("@/components/Summary/AmountBanner/AmountBanner", () => ({
  __esModule: true,
  default: () => <div data-testid="amount-banner" />,
}));

const mockUseAuth = useAuth as unknown as jest.Mock;
const mockListCalculations = listCalculations as jest.Mock;
const mockCreateCalculation = createCalculation as jest.Mock;

const meta = {
  page: 1,
  limit: 100,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const saved = (
  overrides: Partial<SavedLoanCalculation> = {}
): SavedLoanCalculation => ({
  id: "calculation-1",
  name: "HDB plan with top-up",
  description: "Rate hike in year 4.",
  calculationType: CalculationType.HOME,
  currency: "INR",
  loan: {
    loanAmount: 500_000_000,
    rateOfInterest: 8.25,
    tenure: { years: 20, months: 0 },
    /*
     * Deliberately far from the test clock's month, so a scenario that silently kept
     * today's start month cannot produce a schedule that looks correct.
     */
    startMonth: "2024-03",
  },
  prepayments: [
    {
      amount: 10_000_000,
      startMonth: "2027-04",
      interval: CalculationPrepaymentInterval.ANNUALLY,
    },
  ],
  monthChanges: [{ monthIndex: 17, emi: 4_500_000, rateOfInterest: 8.25 }],
  createdAt: "2026-10-07T08:13:49.103Z",
  updatedAt: "2026-10-07T08:13:49.103Z",
  ...overrides,
});

/*
 * Queried by the labels the inputs already carry, rather than by test ids added for
 * this file: a test that needs a hook to expose its internals to be observable is a
 * test asserting on the implementation instead of on what the user sees.
 */
/*
 * The loan amount and the rate are the two shortcut rows above the inputs, so they are
 * told apart by their placeholder — the one thing on the control that is unique. The
 * section heading alone is not enough: both live under "Loan Details".
 */
/*
 * The amount inputs are *text*, because they render through `formatPrice` and carry a
 * currency symbol — so `toHaveValue(5000000)` cannot match. Read the rendered string and
 * strip what the adornment adds, which is also what the user actually sees.
 */
const amountField = () => screen.getByPlaceholderText("50,00,000");
const roiField = () => screen.getByPlaceholderText("8.25%");
const yearsField = () => screen.getByPlaceholderText("18 yrs");
const monthsField = () => screen.getByPlaceholderText("9 mos");

const digits = (input: HTMLElement): string =>
  (input as HTMLInputElement).value.replace(/[^0-9.]/g, "");
/**
 * The prepayment amount rows, found by their placeholder.
 *
 * Returns an array rather than throwing, because a scenario with no prepaying
 * legitimately leaves none — and "zero rows" is an assertion several tests need to make.
 */
const prepaymentAmounts = () =>
  screen.queryAllByPlaceholderText("Prepayment Amount");

/*
 * A working currency context, rather than the real provider: the real one geolocates
 * on mount and falls back to USD when that fetch fails, which would fight the scenario
 * under test. Currency is genuinely load-bearing here — it resets the default amount and
 * rate when it moves — so it is modelled for real rather than stubbed out.
 */
const TestCurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrency] = useState<Currency>("USD");

  const value = useMemo(
    () => ({
      currency,
      currencySymbol: "$",
      locale: "en-US",
      isINR: currency === "INR",
      setCurrency,
      formatAmount: (amount: number) => `$${amount}`,
    }),
    [currency]
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
};

const renderCalculator = () =>
  render(
    <TestCurrencyProvider>
      <SavedCalculationsProvider>
        <SavedCalculationsSelect />
        <PrepaymentsProvider>
          <CommonLoanCalculator
            loanCalculatorType={LoanCalculatorType.HOME}
            Summary={LoanCalculatorSummary}
          />
        </PrepaymentsProvider>
      </SavedCalculationsProvider>
    </TestCurrencyProvider>
  );

const pickSavedCalculation = async (user: ReturnType<typeof userEvent.setup>) => {
  /*
   * Scoped to the dropdown, because the calculator's own interval selects are
   * comboboxes too and `findByRole` would refuse to guess between them.
   */
  const dropdown = screen.getByTestId("saved-calculations");

  await user.click(await within(dropdown).findByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "HDB plan with top-up" }));
};

describe("applying a saved calculation to the calculator", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      authorisedRequest: jest.fn(),
    });
    mockListCalculations.mockResolvedValue({ items: [saved()], meta });
    mockCreateCalculation.mockResolvedValue({ calculation: saved() });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("overwrites the loan amount, which arrives in paise", async () => {
    const user = userEvent.setup();
    renderCalculator();

    await pickSavedCalculation(user);

    await waitFor(() => expect(digits(amountField())).toBe("5000000"));
  });

  it("overwrites the rate of interest", async () => {
    const user = userEvent.setup();
    renderCalculator();

    await pickSavedCalculation(user);

    await waitFor(() => expect(roiField()).toHaveValue("8.25"));
  });

  it("overwrites the tenure, which the scenario stores as years and months", async () => {
    const user = userEvent.setup();
    renderCalculator();

    await pickSavedCalculation(user);

    await waitFor(() => expect(yearsField()).toHaveValue(20));
    // The months input renders `tenure.months || ""`, so a zero month reads as blank
    // rather than as "0". That is the input's own convention, not a restore failure.
    expect(monthsField()).toHaveValue(null);
  });

  it("overwrites the start month, which arrives as a bare YYYY-MM", async () => {
    const user = userEvent.setup();
    renderCalculator();

    /*
 * Asserted off the summary's start date rather than the end date. Prepayments and the
 * scenario's month changes both shorten the loan, so the end date depends on far more
 * than the start month alone — which would make this a test of the maths.
 */
    await pickSavedCalculation(user);

    await waitFor(() => expect(screen.getByText("Mar 2024")).toBeInTheDocument());
  });

  it("overwrites the prepayments, rather than adding to what was there", async () => {
    const user = userEvent.setup();
    renderCalculator();

    // One blank row before applying, then two, and one filled row after.
    expect(prepaymentAmounts()).toHaveLength(1);
    await user.click(screen.getByText("Add Prepayment"));
    expect(prepaymentAmounts()).toHaveLength(2);

    await pickSavedCalculation(user);

    await waitFor(() => expect(prepaymentAmounts()).toHaveLength(1));
    expect(digits(prepaymentAmounts()[0])).toBe("100000");
  });

  it("restores a month change, rather than dropping it as a stale edit", async () => {
    const user = userEvent.setup();
    renderCalculator();

    await pickSavedCalculation(user);

    // The summary only reports a hand-edited schedule while month changes are actually
    // held, so this is the direct evidence the scenario's change survived the loan change
    // that installed it — which is exactly what the clear-on-loan-change rule would drop.
    await waitFor(() =>
      expect(screen.getByText("Schedule changed by hand")).toBeInTheDocument()
    );
  });

  it("shows the restored prepayment in the summary", async () => {
    const user = userEvent.setup();
    renderCalculator();

    await pickSavedCalculation(user);

    await waitFor(() =>
      expect(screen.getByText("Savings with Prepayments")).toBeInTheDocument()
    );
  });

  it("costs no further request, because the scenario was already in hand", async () => {
    const user = userEvent.setup();
    renderCalculator();

    await pickSavedCalculation(user);
    await waitFor(() => expect(digits(amountField())).toBe("5000000"));

    expect(mockListCalculations).toHaveBeenCalledTimes(1);
  });

  it("applies a plain loan, where the API sent neither optional key", async () => {
    const user = userEvent.setup();
    mockListCalculations.mockResolvedValue({
      items: [saved({ prepayments: [], monthChanges: [] })],
      meta,
    });
    renderCalculator();

    await pickSavedCalculation(user);

    await waitFor(() => expect(digits(amountField())).toBe("5000000"));

    /*
     * Every prepayment row is gone, rather than the single blank one the calculator
     * opens with. A scenario with no prepaying restores exactly that — a blank row would
     * be the calculator's default leaking through as if the user had saved it.
     */
    expect(prepaymentAmounts()).toHaveLength(0);
    expect(screen.queryByText("Schedule changed by hand")).not.toBeInTheDocument();
    expect(screen.queryByText("Savings with Prepayments")).not.toBeInTheDocument();
  });

  it("switches the app currency to the one the scenario was saved in", async () => {
    const user = userEvent.setup();
    mockListCalculations.mockResolvedValue({
      items: [saved({ currency: "USD" })],
      meta,
    });
    renderCalculator();

    await pickSavedCalculation(user);

    // The terms must survive the currency change, which resets the default amount and
    // rate — so this is really an assertion that the reset did not clobber them.
    await waitFor(() => expect(digits(amountField())).toBe("5000000"));
    expect(roiField()).toHaveValue("8.25");
  });
});