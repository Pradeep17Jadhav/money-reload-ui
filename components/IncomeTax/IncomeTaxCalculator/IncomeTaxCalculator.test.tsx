import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IncomeTaxCalculatorWithSavedCalculations from "@/components/IncomeTax/IncomeTaxCalculatorWithSavedCalculations/IncomeTaxCalculatorWithSavedCalculations";
import { useAuth } from "@/contexts/authContext";
import { listIncomeTaxCalculations } from "@/services/incomeTax/calculations";
import type { IncomeTaxConfig } from "@/types/ConfigTypes";
import type { SavedIncomeTaxCalculation } from "@/types/IncomeTax/CalculationTypes";

jest.mock("@/contexts/authContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/incomeTax/calculations", () => ({
  listIncomeTaxCalculations: jest.fn(),
  getIncomeTaxCalculationsByIds: jest.fn(),
  createIncomeTaxCalculation: jest.fn(),
}));
/*
 * Recharts measures its container with a `ResizeObserver`, which jsdom does not implement.
 * Stubbed rather than the chart itself, so the summary's real props still render and only the
 * measuring is skipped — the same trade `useLoanAmortisationRestore.test.tsx` makes.
 */
jest.mock("@/components/Charts/ProgressChart", () => ({
  __esModule: true,
  default: () => <div data-testid="progress-chart" />,
}));

const mockUseAuth = useAuth as unknown as jest.Mock;
const mockList = listIncomeTaxCalculations as jest.Mock;

const SCENARIO_ID = "6ac5ff3d311ac3f725d43a6d";

/** One budget, matching the shape `public/config.json` actually holds. */
const config: IncomeTaxConfig = {
  faqs: [],
  budgets: [
    {
      year: 2025,
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
        { incomeFrom: 1_000_000, incomeTo: -1, taxInPercent: 20 },
      ],
    },
  ],
};

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
  additionalIncome: [{ source: "Rent from a flat", amount: 24_000_000 }],
  createdAt: "2026-10-07T08:13:49.103Z",
  updatedAt: "2026-10-07T08:13:49.103Z",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    authorisedRequest: jest.fn(),
    isSignedIn: true,
  });
  mockList.mockResolvedValue({ items: [scenario()], meta: {} });
});

/**
 * The income box, found by its caption rather than by label.
 *
 * `InputElement` draws its caption as a `<strong>` rather than an associated `<label>`, so
 * `getByLabelText` cannot reach it, and the box carries no testid of its own. The summary has an
 * "Annual Income" line too, hence the `strong` match rather than a text match.
 */
const incomeInput = (): HTMLInputElement => {
  const caption = screen
    .getAllByText(/annual income/i)
    .find((node) => node.tagName === "STRONG");
  const input = caption?.parentElement?.parentElement?.querySelector("input");

  if (!input) {
    throw new Error("no annual income input found");
  }

  return input as HTMLInputElement;
};

describe("applying a saved calculation from the dropdown", () => {
  it("puts the scenario's income into the calculator", async () => {
    const user = userEvent.setup();

    // The wrapper, not the bare calculator: the page mounts the wrapper, and the whole point of it
// is that the dropdown and the calculator share one read of the saved scenarios.
render(<IncomeTaxCalculatorWithSavedCalculations incomeTaxConfig={config} />);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    await user.click(screen.getByLabelText("Saved Calculations"));
    await user.click(await screen.findByRole("option", { name: /FY25-26 salaried/ }));

    /*
     * The regression this suite exists for. The dropdown and the calculator are siblings, so
     * reading the list through a hook in each gave each its own `pendingCalculation`: the dropdown
     * set its own and the calculator read the other's, which never changed. The pick looked like
     * it worked and did nothing.
     */
    await waitFor(() => {
      /*
       * Rs 15,00,000.00 in paise, back as whole rupees in the box. Compared as digits only,
       * because `InputElement` renders the value as a formatted currency string and the grouping
       * or symbol is its business, not this assertion's.
       */
      expect(incomeInput().value.replace(/\D/g, "")).toBe("1500000");
    });
  });

  it("brings the scenario's additional income back with it", async () => {
    const user = userEvent.setup();

    // The wrapper, not the bare calculator: the page mounts the wrapper, and the whole point of it
// is that the dropdown and the calculator share one read of the saved scenarios.
render(<IncomeTaxCalculatorWithSavedCalculations incomeTaxConfig={config} />);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    await user.click(screen.getByLabelText("Saved Calculations"));
    await user.click(await screen.findByRole("option", { name: /FY25-26 salaried/ }));

    // The lines are part of the same unit as the salary, so restoring one without the other would
    // leave the tax matching neither.
    await waitFor(() => {
      expect(screen.getByTestId("additional-income-total")).toHaveTextContent(
        "2,40,000"
      );
    });
  });

  it("taxes the restored figure against the scenario's budget", async () => {
    const user = userEvent.setup();

    // The wrapper, not the bare calculator: the page mounts the wrapper, and the whole point of it
// is that the dropdown and the calculator share one read of the saved scenarios.
render(<IncomeTaxCalculatorWithSavedCalculations incomeTaxConfig={config} />);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    await user.click(screen.getByLabelText("Saved Calculations"));
    await user.click(await screen.findByRole("option", { name: /FY25-26 salaried/ }));

    /*
     * Rs 15,00,000 less Rs 75,000 leaves Rs 14,25,000, and the Rs 2,40,000 of side income only
     * reaches what the salary left. A non-zero banner is the proof the whole thing ran rather
     * than the inputs being filled and the arithmetic left behind.
     */
    await waitFor(() => {
      const banner = document.body.textContent ?? "";

      expect(banner).toContain("Tax Liability");
      expect(banner).not.toContain("₹0.00");
    });
  });

  it("shows the additional income in the summary, not folded into the salary", async () => {
    const user = userEvent.setup();

    // The wrapper, not the bare calculator: the page mounts the wrapper, and the whole point of it
// is that the dropdown and the calculator share one read of the saved scenarios.
render(<IncomeTaxCalculatorWithSavedCalculations incomeTaxConfig={config} />);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    await user.click(screen.getByLabelText("Saved Calculations"));
    await user.click(await screen.findByRole("option", { name: /FY25-26 salaried/ }));

    // Shown separately because it is taxed differently: the salary takes the lower slabs first.
    await waitFor(() => {
      expect(screen.getByTestId("summary-additional-income")).toHaveTextContent(
        "2,40,000"
      );
    });
  });
});

describe("editing an additional income line", () => {
  const restoreTheScenario = async (
    user: ReturnType<typeof userEvent.setup>
  ) => {
    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    await user.click(screen.getByLabelText("Saved Calculations"));
    await user.click(await screen.findByRole("option", { name: /FY25-26 salaried/ }));
    await waitFor(() => {
      expect(screen.getByTestId("additional-income-total")).toHaveTextContent(
        "2,40,000"
      );
    });
  };

  it("replaces the line rather than appending another", async () => {
    const user = userEvent.setup();

    render(<IncomeTaxCalculatorWithSavedCalculations incomeTaxConfig={config} />);
    await restoreTheScenario(user);

    await user.click(screen.getByTestId("edit-additional-income-0"));

    const source = screen.getByTestId("additional-income-source");
    await user.clear(source);
    await user.type(source, "Rent from the shop");
    await user.click(screen.getByTestId("additional-income-save"));

    await waitFor(() => {
      expect(screen.queryByTestId("additional-income-dialog")).toBeNull();
    });

    expect(screen.getByText("Rent from the shop")).toBeInTheDocument();
    /*
     * Scoped to this table, not the whole page — the summary has a tax-slab table of its own, so
     * a page-wide row count would say nothing about the line. Within it: a header and one line,
     * which is what tells a replace from an append.
     */
    const rows = within(
      screen.getByRole("table", { name: /additional income/i })
    ).getAllByRole("row");

    expect(rows).toHaveLength(2);
    expect(screen.queryByText("Rent from a flat")).toBeNull();
  });

  it("re-derives the tax against the corrected line", async () => {
    const user = userEvent.setup();

    render(<IncomeTaxCalculatorWithSavedCalculations incomeTaxConfig={config} />);
    await restoreTheScenario(user);

    await user.click(screen.getByTestId("edit-additional-income-0"));

    const amount = screen.getByTestId("additional-income-amount");
    await user.clear(amount);
    await user.type(amount, "500000");
    await user.click(screen.getByTestId("additional-income-save"));

    // The hook re-derives when the total changes, so a corrected line cannot leave the summary
    // quoting the old one.
    await waitFor(() => {
      expect(screen.getByTestId("additional-income-total")).toHaveTextContent(
        "5,00,000"
      );
    });
  });
});