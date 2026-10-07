import { useCallback, useMemo } from "react";
import classnames from "classnames";
import {
  AmortisationRow,
  AmortisationTableFrequency,
  TableColumn,
  TableColumns,
} from "@/types/Loan/LoanTypes";
import { TableRow, TableCell, useMediaQuery, useTheme } from "@mui/material";
import { getCellValue } from "../../../helpers/loan";
import { PREPAYMENTS_COLUMN_WIDTH, TableColumnKeys } from "../../../constants";
import { useCurrency } from "@/contexts/currency";

import styles from "./MonthlyTableRow.module.css";

type Props = {
  monthlyRow: AmortisationRow;
  columns: TableColumns;
  /** The loan this month is part of, used to open the editor. */
  isSelected: boolean;
  hasChanges: boolean;
  onSelectMonth: (monthIndex: number) => void;
};

const MonthlyTableRow = ({
  monthlyRow,
  columns,
  isSelected,
  hasChanges,
  onSelectMonth,
}: Props) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { formatAmount } = useCurrency();

  const label = useMemo(
    () => `Edit the details for month ${monthlyRow.monthIndex + 1}`,
    [monthlyRow.monthIndex]
  );

  const handleSelect = useCallback(() => {
    onSelectMonth(monthlyRow.monthIndex);
  }, [monthlyRow.monthIndex, onSelectMonth]);

  // A row is not a button, so Enter and Space are wired up by hand to keep it
  // reachable without a mouse.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleSelect();
      }
    },
    [handleSelect]
  );

  const getSX = useCallback(
    (col: TableColumn) => {
      const common = {
        backgroundColor: "var(--background)",
        padding: "6px",
      };
      switch (col.key) {
        case TableColumnKeys.YEAR:
          return { ...common, width: isMobile ? "60px" : "72px", padding: 0 };
        case TableColumnKeys.PREPAYMENTS:
          return {
            ...common,
            width: `${PREPAYMENTS_COLUMN_WIDTH}px`,
          };
        default:
          return { ...common };
      }
    },
    [isMobile]
  );

  return (
    <TableRow
      key={monthlyRow.year}
      hover
      tabIndex={0}
      aria-label={label}
      data-testid={`amortisation-month-${monthlyRow.monthIndex}`}
      className={classnames(styles.clickableRow, {
        [styles.selectedRow]: isSelected,
        [styles.changedRow]: hasChanges,
      })}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      sx={{ cursor: "pointer" }}
    >
      {columns.map((col) => (
        <TableCell key={col.key} align="right" sx={getSX(col)}>
          {getCellValue(
            col,
            monthlyRow,
            AmortisationTableFrequency.Monthly,
            formatAmount
          )}
        </TableCell>
      ))}
    </TableRow>
  );
};

export default MonthlyTableRow;