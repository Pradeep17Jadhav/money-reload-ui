import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AmortisationMonthDialog from "@/components/Loan/AmortisationMonthDialog/AmortisationMonthDialog";
import type { AmortisationRow, MonthOverride } from "@/types/Loan/LoanTypes";

jest.mock("@/contexts/currency", () => ({
  useCurrency: () => ({ formatAmount: (amount: number) => String(amount) }),
}));

const month: AmortisationRow = {
  monthIndex: 5,
  year: 202606,
  principalPaid: 80_000,
  prepayments: 0,
  disbursements: 0,
  interestPaid: 10_000,
  totalPaid: 90_000,
  balance: 500_000,
  loanPaidPercent: 50,
  interestRate: 12,
  emi: 88_849,
};

const renderDialog = (overrides: Partial<React.ComponentProps<typeof AmortisationMonthDialog>> = {}) => {
  const onApply = jest.fn();
  const onResetMonth = jest.fn();
  const onClose = jest.fn();

  render(
    <AmortisationMonthDialog
      open
      month={month}
      change={{}}
      openingBalance={600_000}
      onClose={onClose}
      onApply={onApply}
      onResetMonth={onResetMonth}
      {...overrides}
    />
  );

  return { user: userEvent.setup(), onApply, onResetMonth, onClose };
};

const field = (name: string) => screen.getByTestId(`amortisation-${name}`);
const applyButton = () => screen.getByTestId("amortisation-apply");

describe("AmortisationMonthDialog", () => {
  it("prefills each field with what is already in force", () => {
    renderDialog();

    expect(field("emi")).toHaveValue(88_849);
    expect(field("roi")).toHaveValue(12);
    expect(field("prepayment")).toHaveValue(0);
    expect(field("disbursement")).toHaveValue(0);
  });

  describe("additional disbursement", () => {
    it("is offered alongside the prepayment", () => {
      renderDialog();

      expect(screen.getByLabelText(/additional disbursement/i)).toBeInTheDocument();
    });

    it("prefills with what was already advanced that month", () => {
      renderDialog({ month: { ...month, disbursements: 25_000 } });

      expect(field("disbursement")).toHaveValue(25_000);
      expect(applyButton()).toBeDisabled();
    });

    it("sends the amount advanced", async () => {
      const { user, onApply } = renderDialog();

      await user.clear(field("disbursement"));
      await user.type(field("disbursement"), "200000");
      await user.click(applyButton());

      expect(onApply).toHaveBeenCalledWith({ disbursement: 200_000 });
    });

    it("cannot be negative", async () => {
      const { user, onApply } = renderDialog();

      await user.clear(field("disbursement"));
      await user.type(field("disbursement"), "-5000");
      await user.click(applyButton());

      expect(onApply).not.toHaveBeenCalled();
      expect(field("disbursement")).toHaveAttribute("aria-invalid", "true");
    });

    it("leaves the other fields out of the change when only it moves", async () => {
      const { user, onApply } = renderDialog({ month: { ...month, disbursements: 10_000 } });

      await user.clear(field("disbursement"));
      await user.type(field("disbursement"), "30000");
      await user.click(applyButton());

      // The EMI and the rate are unchanged, so they are not resent — they are
      // inherited rather than restated.
      expect(onApply).toHaveBeenCalledWith({ disbursement: 30_000 });
    });

    it("is listed among the month's figures once there is one", () => {
      renderDialog({ month: { ...month, disbursements: 25_000 } });

      const info = screen.getByTestId("amortisation-month-info");
      expect(info).toHaveTextContent(/additional disbursement/i);
      expect(info).toHaveTextContent("25000");
    });

    it("is left out of the figures when nothing was advanced", () => {
      renderDialog();

      const info = screen.getByTestId("amortisation-month-info");
      expect(info).not.toHaveTextContent(/additional disbursement/i);
    });
  });

  it("shows the month it is editing", () => {
    renderDialog();

    expect(screen.getByRole("dialog")).toHaveTextContent(/month 6/i);
  });

  it("shows the month's figures as read-only context", () => {
    renderDialog();

    const info = screen.getByTestId("amortisation-month-info");
    expect(info).toHaveTextContent("600000");
    expect(info).toHaveTextContent("500000");
  });

  describe("Apply", () => {
    it("is disabled until something actually changes", async () => {
      const { user } = renderDialog();

      expect(applyButton()).toBeDisabled();

      // Typing the same value back must not count as a change.
      await user.clear(field("roi"));
      await user.type(field("roi"), "12");

      expect(applyButton()).toBeDisabled();
    });

    it("is enabled once a field differs", async () => {
      const { user } = renderDialog();

      await user.clear(field("emi"));
      await user.type(field("emi"), "95000");

      expect(applyButton()).toBeEnabled();
    });

    it("sends only the field that changed", async () => {
      const { user, onApply } = renderDialog();

      await user.clear(field("emi"));
      await user.type(field("emi"), "95000");
      await user.click(applyButton());

      // The rate and the prepayment are untouched, so they stay inherited rather
      // than being restated as this month's own change.
      expect(onApply).toHaveBeenCalledWith({ emi: 95000 });
    });

    it("sends a change to each field independently", async () => {
      const { user, onApply } = renderDialog();

      await user.clear(field("roi"));
      await user.type(field("roi"), "14");
      await user.clear(field("prepayment"));
      await user.type(field("prepayment"), "25000");
      await user.click(applyButton());

      expect(onApply).toHaveBeenCalledWith({ roi: 14, prepayment: 25000 });
    });

    it("sends a change when a value is lowered too", async () => {
      const { user, onApply } = renderDialog();

      await user.clear(field("roi"));
      await user.type(field("roi"), "9.5");
      await user.click(applyButton());

      expect(onApply).toHaveBeenCalledWith({ roi: 9.5 });
    });

    it("blocks a rate outside the allowed range and says why", async () => {
      const { user, onApply } = renderDialog();

      // The accepted range is the same 0-100 the loan calculator itself allows.
      await user.clear(field("roi"));
      await user.type(field("roi"), "150");
      await user.click(applyButton());

      expect(onApply).not.toHaveBeenCalled();
      expect(await screen.findByText(/between .* and/i)).toBeInTheDocument();
    });

    it("blocks a negative amount", async () => {
      const { user, onApply } = renderDialog();

      await user.clear(field("emi"));
      await user.type(field("emi"), "-500");
      await user.click(applyButton());

      expect(onApply).not.toHaveBeenCalled();
      expect(await screen.findByText(/cannot be negative/i)).toBeInTheDocument();
    });
  });

  describe("Reset", () => {
    it("puts back the values that are in force and keeps the dialog open", async () => {
      const { user, onResetMonth } = renderDialog();

      await user.clear(field("emi"));
      await user.type(field("emi"), "99999");
      expect(field("emi")).toHaveValue(99999);

      await user.click(screen.getByTestId("amortisation-reset"));

      // The dialog stays put, so the user can carry on editing the same month.
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(field("emi")).toHaveValue(88_849);
      expect(applyButton()).toBeDisabled();
      expect(onResetMonth).toHaveBeenCalled();
    });
  });

  it("keeps the hint short", () => {
    renderDialog();

    expect(
      screen.getByText(/applies from this month to the end of the tenure/i)
    ).toBeInTheDocument();
  });

  it("says which changes are one-off and which carry forward", () => {
    renderDialog();

    // A prepayment and a disbursement both land in a single month, while an EMI or
    // rate change stands until the end of the tenure. Saying so is the only place
    // the difference is explained.
    expect(
      screen.getByText(/prepayment or additional disbursement applies to this month only/i)
    ).toBeInTheDocument();
  });

  it("closes without applying anything on Cancel", async () => {
    const { user, onApply, onClose } = renderDialog();

    await user.clear(field("emi"));
    await user.type(field("emi"), "99999");
    await user.click(screen.getByTestId("amortisation-cancel"));

    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});