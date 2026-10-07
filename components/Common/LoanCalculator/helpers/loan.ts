import {
  AmortisationTableFrequency,
  AmortisationRow,
  TableColumn,
} from "../../../../types/Loan/LoanTypes";
import { columnsWithPrice, TableColumnKeys } from "../constants";

export const getCellValue = (
  col: TableColumn,
  row: AmortisationRow,
  frequency: AmortisationTableFrequency,
  formatAmount: (amount: number, decimals?: number | undefined) => string
) => {
  if (columnsWithPrice.includes(col.key)) {
    return formatAmount(row[col.key as keyof AmortisationRow]);
  }
  if (col.key === TableColumnKeys.LOAN_PAID_PERCENT) {
    return `${row[col.key as keyof AmortisationRow].toFixed(2)}%`;
  }
  // A rate is a percentage, not money, so it never goes through `formatAmount`.
  if (col.key === TableColumnKeys.ROI) {
    return `${formatRate(row.interestRate)}%`;
  }
  if (col.key === "year") {
    return getPrintableMonthYear(
      frequency,
      row[col.key as keyof AmortisationRow]
    );
  }

  return row[col.key as keyof AmortisationRow];
};

/** Renders a rate with at most two decimals, dropping trailing zeros. */
export const formatRate = (rate: number): string =>
  rate.toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * Converts from YYYYMM i.e. 202503 to March 2025
 * @param frequency
 * @param YYYYMM
 * @returns
 */
export const getPrintableMonthYear = (
  frequency: AmortisationTableFrequency,
  YYYYMM: number,
  fullMonth: boolean = false,
  onlyYear: boolean = false
) => {
  const yearMonthStr = YYYYMM.toString();
  if (frequency === AmortisationTableFrequency.Yearly) {
    return onlyYear ? yearMonthStr.slice(0, 4) : yearMonthStr;
  }
  const monthStr = new Date(
    parseInt(yearMonthStr.substring(0, 4)),
    parseInt(yearMonthStr.substring(4, 6)) - 1
  ).toLocaleString("en-US", { month: "short", year: "numeric" });
  return fullMonth ? monthStr : monthStr.split(" ")[0];
};
