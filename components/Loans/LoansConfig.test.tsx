import { render } from "@testing-library/react";
import { LOAN_COLUMNS, LOAN_FIELDS } from "@/components/Loans/LoansConfig";
import { buildPayload, emptyValues } from "@/helpers/recordForm";
import { LoanStatus, LoanType, InterestType } from "@/types/FinanceTypes";
import type { Loan } from "@/types/FinanceTypes";

/**
 * A loan the API would return, with every field present. Built whole rather than partially so
 * a test cannot pass by reading a field that happens not to exist — `undefined` would render
 * and total as something plausible.
 */
const loan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "loan-1",
  title: "Home loan",
  lender: "HDFC Bank",
  loanType: LoanType.HOME,
  principal: 500_000_000,
  interestRate: 8,
  interestType: InterestType.REDUCING_BALANCE,
  startDate: "2024-01-01",
  endDate: "2044-01-01",
  emiAmount: 41_822,
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

/** The text a column renders for one loan. */
const cellText = (key: string, subject: Loan): string => {
  const column = LOAN_COLUMNS.find((entry) => entry.key === key);

  if (!column) {
    throw new Error(`no column keyed ${key}`);
  }

  const { container } = render(<>{column.render(subject)}</>);

  return container.textContent ?? "";
};

describe("the loan title", () => {
  it("is the first column, because it is what a list is scanned for", () => {
    // The bank issues many loans, so the bank is context for the title rather than a second
    // way of identifying the row — and the title is the user's own name for it.
    expect(LOAN_COLUMNS[0].key).toBe("title");
    expect(LOAN_COLUMNS[0].header).toBe("Loan");
  });

  it("shows the title with the lender beneath it", () => {
    const text = cellText("title", loan({ title: "Kitchen renovation", lender: "HDFC Bank" }));

    expect(text).toContain("Kitchen renovation");
    expect(text).toContain("HDFC Bank");
  });

  it("tells two loans from one bank apart", () => {
    const first = cellText("title", loan({ title: "Home loan", lender: "HDFC Bank" }));
    const second = cellText("title", loan({ title: "Car loan", lender: "HDFC Bank" }));

    // Same lender, different loans — which is the whole reason the title exists.
    expect(first).not.toBe(second);
  });

  it("is a required field in the add-loan form", () => {
    const field = LOAN_FIELDS.find((entry) => entry.name === "title");

    expect(field).toBeDefined();
    expect(field).toMatchObject({ kind: "text", required: true });
  });

  it("is asked for before anything else", () => {
    // First in the form as well as the table, so the naming happens before the detail.
    expect(LOAN_FIELDS[0].name).toBe("title");
  });

  it("sends what the user typed", () => {
    const payload = buildPayload(LOAN_FIELDS, {
      ...emptyValues(LOAN_FIELDS),
      title: "Kitchen renovation",
    });

    expect(payload.title).toBe("Kitchen renovation");
  });

  it("is left out entirely when blank, so the API reports it as missing", () => {
    const payload = buildPayload(LOAN_FIELDS, {
      ...emptyValues(LOAN_FIELDS),
      title: "",
    });

    // Omitted rather than sent empty: an empty title is a missing title, and the API's own
    // required check is a better message than anything guessed here.
    expect("title" in payload).toBe(false);
  });
});

describe("the undisbursed amount", () => {
  it("offers a field in the add-loan form", () => {
    const field = LOAN_FIELDS.find((entry) => entry.name === "undisbursedAmount");

    expect(field).toBeDefined();
    expect(field?.kind).toBe("money");
    // Optional: nobody is obliged to know how much of their loan is still to arrive.
    expect(field).not.toMatchObject({ required: true });
  });

  it("sends rupees as integer paise, like every other amount", () => {
    const payload = buildPayload(LOAN_FIELDS, {
      ...emptyValues(LOAN_FIELDS),
      undisbursedAmount: "150000",
    });

    expect(payload.undisbursedAmount).toBe(15_000_000);
  });

  it("leaves the key out entirely when the user has not said", () => {
    const payload = buildPayload(LOAN_FIELDS, {
      ...emptyValues(LOAN_FIELDS),
      undisbursedAmount: "",
    });

    /*
     * Absent, not zero. A loan with no undisbursed amount is one nobody has said anything
     * about, which is a different fact from a loan fully released.
     */
    expect("undisbursedAmount" in payload).toBe(false);
  });

  it("is nowhere in the table", () => {
    const withAnAmount = loan({ undisbursedAmount: 15_000_000 });

    expect(LOAN_COLUMNS.some((entry) => entry.key === "undisbursed")).toBe(false);

    /*
     * Every column rendered, rather than the config read: a column reaching for the figure
     * under some other key would slip past a check that only looks for the old one.
     */
    for (const column of LOAN_COLUMNS) {
      expect(cellText(column.key, withAnAmount)).not.toContain("to receive");
    }
  });
});

describe("the rate", () => {
  it("is a single column, and says so once", () => {
    /*
     * It was drawn twice under one heading — a plain rate column, and a second that repeated
     * the rate above the undisbursed amount. Two columns headed "Rate" is not a layout
     * choice; it reads as a mistake, and sorting by the first would leave the second blank.
     */
    const headers = LOAN_COLUMNS.map((entry) => entry.header);

    expect(headers.filter((header) => header === "Rate")).toHaveLength(1);
    // And no two columns share any heading, so the same thing cannot recur.
    expect(new Set(headers).size).toBe(headers.length);
  });

  it("shows a dash for the rate of an unresolvable import, rather than a zero", () => {
    const orphan = loan({
      loanCalculationId: "6ac5ff3d311ac3f725d43a6d",
      principal: null,
      interestRate: null,
      endDate: null,
      emiAmount: null,
    });

    // 0% would read as a genuine free loan; the dash says the figure is missing.
    expect(cellText("rate", orphan)).not.toContain("0%");
  });

  it("shows the rate on its own for an ordinary loan", () => {
    expect(cellText("rate", loan({ interestRate: 8 }))).toBe("8.00%");
  });
});