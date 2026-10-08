import { renderHook, waitFor } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import { useAuth } from "@/contexts/authContext";
import { listInvestments } from "@/services/finance/records";
import { useInvestmentOverview } from "@/components/Investments/useInvestmentOverview";
import InvestmentTypeTabs from "@/components/Investments/InvestmentTypeTabs/InvestmentTypeTabs";
import { InvestmentStatus, InvestmentType } from "@/types/FinanceTypes";
import type { Investment } from "@/types/FinanceTypes";

jest.mock("@/contexts/authContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/finance/records", () => ({ listInvestments: jest.fn() }));

const mockUseAuth = useAuth as unknown as jest.Mock;
const mockListInvestments = listInvestments as unknown as jest.Mock;

const holding = (overrides: Partial<Investment> = {}): Investment => ({
  id: "inv-1",
  title: "HDFC FD",
  type: InvestmentType.FD,
  startDate: "2024-01-05",
  amount: 50_000_000,
  monthlyAmount: null,
  rate: 7.25,
  tenureYears: 5,
  tenureMonths: 0,
  tenureDays: 0,
  compoundingsPerYear: 4,
  stepUpPercent: null,
  currentValue: null,
  institution: "HDFC Bank",
  reference: null,
  notes: null,
  status: InvestmentStatus.ACTIVE,
  createdAt: "2024-01-05T00:00:00.000Z",
  updatedAt: "2024-01-05T00:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ authorisedRequest: jest.fn() });
});

describe("which kinds of holding the user has", () => {
  it("reports every type present, so a table can be offered for each", async () => {
    mockListInvestments.mockResolvedValue({
      items: [
        holding({ id: "a", type: InvestmentType.FD }),
        holding({ id: "b", type: InvestmentType.STOCKS }),
        holding({ id: "c", type: InvestmentType.MUTUAL_FUND }),
        holding({ id: "d", type: InvestmentType.FD }),
      ],
    });

    const { result } = renderHook(() => useInvestmentOverview());

    await waitFor(() => {
      expect(result.current.totals.recordCount).toBe(4);
    });

    /*
     * The whole mechanism. If this list comes back empty the tab bar renders nothing at all and
     * the screen silently falls back to one mixed table — which is exactly what "I still see
     * them in the same table" looks like from the outside.
     */
    expect(result.current.typesPresent.sort()).toEqual(
      [InvestmentType.FD, InvestmentType.STOCKS, InvestmentType.MUTUAL_FUND].sort()
    );
  });

  it("totals each kind separately, so choosing a tab costs no extra request", async () => {
    mockListInvestments.mockResolvedValue({
      items: [
        holding({ id: "a", type: InvestmentType.FD, amount: 50_000_000 }),
        holding({ id: "b", type: InvestmentType.STOCKS, amount: 20_000_000, rate: null, tenureYears: null, currentValue: 30_000_000 }),
      ],
    });

    const { result } = renderHook(() => useInvestmentOverview());

    await waitFor(() => {
      expect(result.current.totals.recordCount).toBe(2);
    });

    /*
     * One read, totalled both ways. Re-reading per tab would either double the requests or
     * force this hook to wait on the table it is deciding which table to show — and splitting
     * by kind here is what breaks that cycle.
     */
    expect(result.current.byType.get(InvestmentType.FD)?.recordCount).toBe(1);
    expect(
      result.current.byType.get(InvestmentType.STOCKS)?.totalCurrentValue
    ).toBe(30_000_000);
    expect(result.current.totals.recordCount).toBe(2);
  });
});

describe("the tab bar", () => {
  it("offers a tab per kind, and nothing for a kind nobody holds", () => {
    render(
      <InvestmentTypeTabs
        typesPresent={[InvestmentType.FD, InvestmentType.STOCKS]}
        selected={null}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByTestId("investment-tab-fd")).toBeInTheDocument();
    expect(screen.getByTestId("investment-tab-stocks")).toBeInTheDocument();
    // A seventeen-way menu of which two are used would put the vocabulary on screen as though
    // it were a summary of what the user owns.
    expect(screen.queryByTestId("investment-tab-ppf")).toBeNull();
  });

  it("offers Everything only once there is more than one kind", () => {
    const { rerender } = render(
      <InvestmentTypeTabs
        typesPresent={[InvestmentType.FD]}
        selected={InvestmentType.FD}
        onSelect={jest.fn()}
      />
    );

    // With a single kind, "Everything" would be that kind's table under a vaguer name.
    expect(screen.queryByTestId("investment-tab-all")).toBeNull();

    rerender(
      <InvestmentTypeTabs
        typesPresent={[InvestmentType.FD, InvestmentType.STOCKS]}
        selected={null}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByTestId("investment-tab-all")).toBeInTheDocument();
  });

  it("marks the table on screen as selected", () => {
    render(
      <InvestmentTypeTabs
        typesPresent={[InvestmentType.FD, InvestmentType.STOCKS]}
        selected={InvestmentType.STOCKS}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByTestId("investment-tab-stocks")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByTestId("investment-tab-fd")).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("renders nothing at all when the user has no holdings", () => {
    const { container } = render(
      <InvestmentTypeTabs typesPresent={[]} selected={null} onSelect={jest.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("hands the chosen kind back", async () => {
    const onSelect = jest.fn();

    render(
      <InvestmentTypeTabs
        typesPresent={[InvestmentType.FD, InvestmentType.STOCKS]}
        selected={null}
        onSelect={onSelect}
      />
    );

    screen.getByTestId("investment-tab-fd").click();

    expect(onSelect).toHaveBeenCalledWith(InvestmentType.FD);
  });
});