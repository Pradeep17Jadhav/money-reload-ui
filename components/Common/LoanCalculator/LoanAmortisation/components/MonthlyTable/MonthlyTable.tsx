import { useMemo } from "react";
import { AmortisationRow, TableColumns } from "@/types/Loan/LoanTypes";
import {
  TableRow,
  TableCell,
  Table,
  TableBody,
  TableHead,
} from "@mui/material";
import MonthlyTableRow from "../MonthlyTableRow/MonthlyTableRow";
import type { AmortisationOverrides } from "@/types/Loan/LoanTypes";

import styles from "./MonthlyTable.module.css";

type Props = {
  monthlyData: AmortisationRow[];
  columns: TableColumns;
  overrides: AmortisationOverrides;
  selectedMonthIndex: number | null;
  onSelectMonth: (monthIndex: number) => void;
};

const MonthlyTable = ({
  monthlyData,
  columns,
  overrides,
  selectedMonthIndex,
  onSelectMonth,
}: Props) => {
  const headerRows = useMemo(
    () =>
      columns.map(({ key, label }) => (
        <TableCell
          key={key}
          align="right"
          sx={
            key === "year" ? { width: "72px", padding: 0 } : { padding: "6px" }
          }
        >
          {label}
        </TableCell>
      )),
    [columns]
  );

  return (
    <Table
      className={styles.collapsibleTable}
      size="small"
      sx={{ tableLayout: "fixed" }}
    >
      <TableHead className={styles.hiddenHeader}>
        <TableRow>{headerRows}</TableRow>
      </TableHead>
      <TableBody>
        {monthlyData.map((monthlyRow) => (
          <MonthlyTableRow
            key={monthlyRow.monthIndex}
            monthlyRow={monthlyRow}
            columns={columns}
            isSelected={selectedMonthIndex === monthlyRow.monthIndex}
            hasChanges={!!overrides[monthlyRow.monthIndex]}
            onSelectMonth={onSelectMonth}
          />
        ))}
      </TableBody>
    </Table>
  );
};

export default MonthlyTable;