import { TableColumns } from "@/types/Loan/LoanTypes";

enum ColumnLabels {
  YEAR = "Year",
  PRINCIPAL = "Principal",
  PREPAYMENT = "Prepayment",
  INTEREST = "Interest",
  ROI = "ROI",
  BALANCE = "Balance",
  TOTAL_PAYMENT = "Total Payment",
  LOAN_PAID_PERCENT = "Loan Paid %",
}

export const TableColumnKeys = {
  YEAR: "year",
  PRINCIPAL_PAID: "principalPaid",
  PREPAYMENTS: "prepayments",
  INTEREST_PAID: "interestPaid",
  ROI: "interestRate",
  TOTAL_PAID: "totalPaid",
  BALANCE: "balance",
  LOAN_PAID_PERCENT: "loanPaidPercent",
};

/**
 * The rate in force only differs from the loan's rate once the user has changed
 * one, so the ROI column stays hidden until then. Prepayments shows up for a
 * manual change too, since a change is one of the ways to introduce one.
 */
const isVisibleColumn = (
  key: string,
  hasPrepayments: boolean,
  hasManualChanges: boolean
): boolean => {
  if (key === TableColumnKeys.PREPAYMENTS) {
    return hasPrepayments || hasManualChanges;
  }

  if (key === TableColumnKeys.ROI) {
    return hasManualChanges;
  }

  return true;
};

const desktopColumns: TableColumns = [
  { key: TableColumnKeys.YEAR, label: ColumnLabels.YEAR },
  { key: TableColumnKeys.PRINCIPAL_PAID, label: ColumnLabels.PRINCIPAL },
  { key: TableColumnKeys.PREPAYMENTS, label: ColumnLabels.PREPAYMENT },
  { key: TableColumnKeys.INTEREST_PAID, label: ColumnLabels.INTEREST },
  { key: TableColumnKeys.ROI, label: ColumnLabels.ROI },
  { key: TableColumnKeys.TOTAL_PAID, label: ColumnLabels.TOTAL_PAYMENT },
  { key: TableColumnKeys.BALANCE, label: ColumnLabels.BALANCE },
  {
    key: TableColumnKeys.LOAN_PAID_PERCENT,
    label: ColumnLabels.LOAN_PAID_PERCENT,
  },
];

export const getDesktopColumns = (
  hasPrepayments: boolean,
  hasManualChanges = false
) =>
  desktopColumns.filter((col) =>
    isVisibleColumn(col.key, hasPrepayments, hasManualChanges)
  );

const tabletColumns: TableColumns = [
  { key: TableColumnKeys.YEAR, label: ColumnLabels.YEAR },
  { key: TableColumnKeys.PRINCIPAL_PAID, label: ColumnLabels.PRINCIPAL },
  { key: TableColumnKeys.PREPAYMENTS, label: ColumnLabels.PREPAYMENT },
  { key: TableColumnKeys.INTEREST_PAID, label: ColumnLabels.INTEREST },
  { key: TableColumnKeys.ROI, label: ColumnLabels.ROI },
  { key: TableColumnKeys.BALANCE, label: ColumnLabels.BALANCE },
];

export const getTabletColumns = (
  hasPrepayments: boolean,
  hasManualChanges = false
) =>
  tabletColumns.filter((col) =>
    isVisibleColumn(col.key, hasPrepayments, hasManualChanges)
  );

export const columnsWithPrice = [
  TableColumnKeys.PRINCIPAL_PAID,
  TableColumnKeys.PREPAYMENTS,
  TableColumnKeys.INTEREST_PAID,
  TableColumnKeys.TOTAL_PAID,
  TableColumnKeys.BALANCE,
];

export const PREPAYMENTS_COLUMN_WIDTH = 120;
export const YEAR_COLUMN_WIDTH = 72;
