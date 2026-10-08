import { useCallback, useMemo } from "react";
import {
  AmortisationRow,
  AmortisationTableFrequency,
  TableColumns,
} from "@/types/Loan/LoanTypes";
import { TableRow, TableCell } from "@mui/material";
import { getCellValue } from "../../../helpers/loan";
import CellWithExpand from "../../../CellRenderers/CellWithExpand/CellWithExpand";
import { PREPAYMENTS_COLUMN_WIDTH, TableColumnKeys } from "../../../constants";
import { useCurrency } from "@/contexts/currency";

import styles from "./YearlyTableRow.module.css";

type Props = {
  yearlyRow: AmortisationRow;
  columns: TableColumns;
  isExpanded: boolean;
  toggleRow: (year: number) => void;
};

const YearlyTableRow = ({
  yearlyRow,
  columns,
  isExpanded,
  toggleRow,
}: Props) => {
  const { formatAmount } = useCurrency();

  const handleToggle = useCallback(() => {
    toggleRow(yearlyRow.year);
  }, [toggleRow, yearlyRow.year]);

  // The whole row is the control, so Enter and Space are wired up by hand to keep
  // it reachable without a mouse.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  const memoizedValues = useMemo(
    () =>
      columns.map((col) => ({
        key: col.key,
        value: getCellValue(
          col,
          yearlyRow,
          AmortisationTableFrequency.Yearly,
          formatAmount
        ),
      })),
    [columns, formatAmount, yearlyRow]
  );

  const renderCell = useCallback(
    ({ key, value }: { key: string; value: string | number }) => {
      switch (key) {
        case TableColumnKeys.YEAR: {
          return (
            <CellWithExpand
              key={key}
              value={value}
              isExpanded={isExpanded}
              align="right"
            />
          );
        }
        case TableColumnKeys.PREPAYMENTS: {
          return (
            <TableCell
              key={key}
              sx={{
                width: `${PREPAYMENTS_COLUMN_WIDTH}px`,
                padding: "6px",
              }}
              align="right"
            >
              {value}
            </TableCell>
          );
        }
        default: {
          return (
            <TableCell key={key} sx={{ padding: "6px" }} align="right">
              {value}
            </TableCell>
          );
        }
      }
    },
    [yearlyRow.year, toggleRow, isExpanded]
  );

  return (
    <TableRow
      hover
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
      aria-label={`${isExpanded ? "Collapse" : "Expand"} the months of ${yearlyRow.year}`}
      data-testid={`amortisation-year-${yearlyRow.year}`}
      className={styles.clickableRow}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
    >
      {memoizedValues.map(renderCell)}
    </TableRow>
  );
};

export default YearlyTableRow;
