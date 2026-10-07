import { AmortisationRow, TableColumns } from "@/types/Loan/LoanTypes";
import type { AmortisationOverrides } from "@/types/Loan/LoanTypes";
import { Table } from "@mui/material";
import YearlyTableHeader from "../YearlyTableHeader/YearlyTableHeader";
import YearlyTableBody from "../YearlyTableBody/YearlyTableBody";

import styles from "./YearlyTable.module.css";

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

const YearlyTable = ({
  expandedRows,
  amortisationDataYearly,
  amortisationDataMonthly,
  columns,
  toggleRow,
  overrides,
  selectedMonthIndex,
  onSelectMonth,
}: Props) => {
  return (
    <Table
      className={styles.table}
      size="small"
      sx={{
        tableLayout: "fixed",
        minWidth: "450px",
      }}
    >
      <YearlyTableHeader columns={columns} />
      <YearlyTableBody
        expandedRows={expandedRows}
        amortisationDataYearly={amortisationDataYearly}
        amortisationDataMonthly={amortisationDataMonthly}
        columns={columns}
        toggleRow={toggleRow}
        overrides={overrides}
        selectedMonthIndex={selectedMonthIndex}
        onSelectMonth={onSelectMonth}
      />
    </Table>
  );
};

export default YearlyTable;
