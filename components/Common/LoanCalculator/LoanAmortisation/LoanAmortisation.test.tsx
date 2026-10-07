import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoanAmortisation from "@/components/Common/LoanCalculator/LoanAmortisation/LoanAmortisation";
import { getDesktopColumns } from "@/components/Common/LoanCalculator/constants";
import type { AmortisationRow } from "@/types/Loan/LoanTypes";

jest.mock("@/contexts/currency", () => ({
  useCurrency: () => ({ formatAmount: (amount: number) => String(amount) }),
}));

/** One row per month, so a two-year loan has two year rows to expand. */
const buildRows = (): {
  yearly: AmortisationRow[];
  monthly: AmortisationRow[];
} => {
  const monthly: AmortisationRow[] = [];

  for (let index = 0; index < 24; index += 1) {
    monthly.push({
      monthIndex: index,
      // YYYYMM, which is what the real schedule produces and what the year is
      // read back out of.
      year: (2026 + Math.floor(index / 12)) * 100 + (index % 12) + 1,
      principalPaid: 80_000,
      prepayments: 0,
      disbursements: 0,
      interestPaid: 10_000,
      totalPaid: 90_000,
      balance: 1_000_000 - (index + 1) * 80_000,
      loanPaidPercent: ((index + 1) * 80_000 * 100) / 1_000_000,
      interestRate: 12,
      emi: 90_000,
    });
  }

  const yearly = [2026, 2027].map((year) => {
    const months = monthly.filter((row) => Math.floor(row.year / 100) === year);

    return {
      ...months[months.length - 1],
      // A year row is identified by the plain year, not by a month.
      year,
      monthIndex: months[0].monthIndex,
    };
  });

  return { yearly, monthly };
};

const renderTable = (overrides: { onApplyMonthChange?: jest.Mock } = {}) => {
  const { yearly, monthly } = buildRows();
  const onApplyMonthChange = overrides.onApplyMonthChange ?? jest.fn();

  render(
    <LoanAmortisation
      hasPrepayments={false}
      hasManualChanges
      amortisationDataYearly={yearly}
      amortisationDataMonthly={monthly}
      downloadAmortisation={jest.fn()}
      overrides={{}}
      onApplyMonthChange={onApplyMonthChange}
      onResetMonthChange={jest.fn()}
    />
  );

  return { user: userEvent.setup(), onApplyMonthChange, monthly };
};

const yearRow = (year: number) => screen.getByTestId(`amortisation-year-${year}`);

/** Whether a month's row is currently mounted under its year. */
const isMonthVisible = (month: AmortisationRow) =>
  screen.queryByTestId(`amortisation-month-${month.monthIndex}`) !== null;

const openMonth = (month: AmortisationRow) =>
  screen.getByTestId(`amortisation-month-${month.monthIndex}`);

describe("year rows", () => {
  it("expands when the row is clicked", async () => {
    const { user, monthly } = renderTable();

    expect(isMonthVisible(monthly[0])).toBe(false);

    await user.click(yearRow(2026));

    expect(isMonthVisible(monthly[0])).toBe(true);
    expect(isMonthVisible(monthly[12])).toBe(false);
  });

  it("collapses again when clicked a second time", async () => {
    const { user, monthly } = renderTable();

    await user.click(yearRow(2026));
    expect(isMonthVisible(monthly[0])).toBe(true);

    await user.click(yearRow(2026));

    // The complaint was that a collapsed row did nothing at all.
    expect(isMonthVisible(monthly[0])).toBe(false);
  });

  it("opens with the keyboard", async () => {
    const { user, monthly } = renderTable();

    yearRow(2027).focus();
    await user.keyboard("{Enter}");

    expect(isMonthVisible(monthly[12])).toBe(true);
  });

  it("toggles on Space without scrolling the page", async () => {
    const { user, monthly } = renderTable();

    yearRow(2027).focus();
    await user.keyboard(" ");

    expect(isMonthVisible(monthly[12])).toBe(true);
  });

  it("reports its state to assistive technology", async () => {
    const { user } = renderTable();

    expect(yearRow(2026)).toHaveAttribute("aria-expanded", "false");

    await user.click(yearRow(2026));

    expect(yearRow(2026)).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps several years open at once", async () => {
    const { user, monthly } = renderTable();

    await user.click(yearRow(2026));
    await user.click(yearRow(2027));

    expect(isMonthVisible(monthly[0])).toBe(true);
    expect(isMonthVisible(monthly[12])).toBe(true);
  });
});

describe("saving a month change", () => {
  it("does not collapse the year the month belongs to", async () => {
    const onApplyMonthChange = jest.fn();
    const { user, monthly } = renderTable({ onApplyMonthChange });

    await user.click(yearRow(2026));
    expect(isMonthVisible(monthly[0])).toBe(true);

    // Open a month, change it and save.
    await user.click(openMonth(monthly[2]));
    const emi = screen.getByTestId("amortisation-emi");
    await user.clear(emi);
    await user.type(emi, "95000");
    await user.click(screen.getByTestId("amortisation-apply"));

    expect(onApplyMonthChange).toHaveBeenCalledWith(2, { emi: 95000 });

    // This used to snap shut, forcing the user to open it again by hand.
    expect(isMonthVisible(monthly[0])).toBe(true);
  });

  it("leaves every other year alone too", async () => {
    const { user, monthly } = renderTable();

    await user.click(yearRow(2026));
    await user.click(yearRow(2027));

    await user.click(openMonth(monthly[0]));
    const emi = screen.getByTestId("amortisation-emi");
    await user.clear(emi);
    await user.type(emi, "95000");
    await user.click(screen.getByTestId("amortisation-apply"));

    expect(isMonthVisible(monthly[0])).toBe(true);
    expect(isMonthVisible(monthly[12])).toBe(true);
  });
});