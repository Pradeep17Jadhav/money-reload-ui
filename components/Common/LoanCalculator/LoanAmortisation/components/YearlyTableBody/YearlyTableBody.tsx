import { Fragment } from "react";
import { AmortisationRow, TableColumns } from "@/types/Loan/LoanTypes";
import type { AmortisationOverrides } from "@/types/Loan/LoanTypes";
import { TableRow, TableCell, TableBody, Collapse } from "@mui/material";
import YearlyTableRow from "../YearlyTableRow/YearlyTableRow";
import MonthlyTable from "../MonthlyTable/MonthlyTable";

type Props = {
  expandedRows: Set<number>;
  amortisationDataYearly: AmortisationRow[];
  amortisationDataMonthly: AmortisationRow[];
  columns: TableColumns;
  toggleRow: (year: number) => void;
  overrides: AmortisationOverrides;
  selectedMonthIndex: number | null;
  onSelectMonth: (monthIndex: number) => void;
};

const YearlyTableBody = ({
  expandedRows,
  amortisationDataYearly,
  amortisationDataMonthly,
  columns,
  toggleRow,
  overrides,
  selectedMonthIndex,
  onSelectMonth,
}: Props) => {
  const getMonthlyDataForYear = (year: number) => {
    return amortisationDataMonthly.filter(
      (row) => Math.floor(row.year / 100) === year
    );
  };

  return (
    <TableBody>
      {amortisationDataYearly.map((yearlyRow) => {
        const monthlyData = getMonthlyDataForYear(yearlyRow.year);
        const isExpanded = expandedRows.has(yearlyRow.year);
        return (
          <Fragment key={yearlyRow.year}>
            <YearlyTableRow
              yearlyRow={yearlyRow}
              columns={columns}
              isExpanded={isExpanded}
              toggleRow={toggleRow}
            />
            <TableRow>
              <TableCell colSpan={columns.length} style={{ padding: 0 }}>
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <MonthlyTable
                  monthlyData={monthlyData}
                  columns={columns}
                  overrides={overrides}
                  selectedMonthIndex={selectedMonthIndex}
                  onSelectMonth={onSelectMonth}
                />
                </Collapse>
              </TableCell>
            </TableRow>
          </Fragment>
        );
      })}
    </TableBody>
  );
};

export default YearlyTableBody;
