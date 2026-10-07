import { formatDateOnly } from "@/helpers/dates";
import { formatPaise, formatPercent } from "@/helpers/money";
import { Badge, CellStack } from "@/components/Records/RecordTable/RecordTable";
import type { TableColumn } from "@/components/Records/RecordTable/RecordTable";
import {
  INTEREST_TYPE_OPTIONS,
  LOAN_STATUS_OPTIONS,
  LOAN_STATUS_TONE,
  LOAN_SORTS,
  LOAN_TYPE_OPTIONS,
  labelForEnumValue,
  sortOptions,
} from "@/constants/records";
import type { MultiFilter } from "@/components/Records/RecordToolbar/RecordToolbar";
import type { SummaryTile } from "@/components/Records/SummaryTiles/SummaryTiles";
import type { FieldConfig } from "@/types/RecordFormTypes";
import type { Loan, LoansSummary } from "@/types/FinanceTypes";

/**
 * Everything that makes the loans screen its own screen.
 *
 * Note what is absent: there is no outstanding balance and no payoff figure.
 * The API has no repayment ledger, so any such number would be invented rather
 * than read. Only what the record stores is shown.
 */
export const LOAN_FIELDS: FieldConfig[] = [
  { kind: "text", name: "lender", label: "lender", required: true, minLength: 1, maxLength: 120 },
  { kind: "select", name: "loanType", label: "loan type", required: true, options: LOAN_TYPE_OPTIONS },
  { kind: "money", name: "principal", label: "principal", required: true, helper: "The amount borrowed." },
  { kind: "percent", name: "interestRate", label: "interest rate", required: true, helper: "A percentage, e.g. 8.75" },
  { kind: "select", name: "interestType", label: "interest type", required: true, options: INTEREST_TYPE_OPTIONS },
  { kind: "date", name: "startDate", label: "start date", required: true },
  { kind: "date", name: "endDate", label: "end date", required: true },
  { kind: "money", name: "emiAmount", label: "EMI amount", helper: "Leave blank for non-EMI loans." },
  { kind: "number", name: "emiDay", label: "EMI day", min: 1, max: 28 },
  { kind: "number", name: "tenureMonths", label: "tenure (months)", min: 1, max: 600 },
  { kind: "select", name: "status", label: "status", options: LOAN_STATUS_OPTIONS },
  { kind: "text", name: "purpose", label: "purpose", maxLength: 300 },
  { kind: "text", name: "reference", label: "reference", maxLength: 60 },
  { kind: "text", name: "notes", label: "notes", maxLength: 2000, multiline: true },
];

export const LOAN_COLUMNS: TableColumn<Loan>[] = [
  {
    key: "lender",
    header: "Lender",
    render: (loan) => <CellStack primary={loan.lender} secondary={loan.reference ?? undefined} />,
  },
  { key: "loanType", header: "Type", render: (loan) => labelForEnumValue(loan.loanType) },
  { key: "principal", header: "Principal", numeric: true, render: (loan) => formatPaise(loan.principal) },
  {
    key: "emi",
    header: "EMI",
    numeric: true,
    render: (loan) => (loan.emiAmount ? formatPaise(loan.emiAmount) : "-"),
  },
  { key: "rate", header: "Rate", numeric: true, render: (loan) => formatPercent(loan.interestRate) },
  {
    key: "dates",
    header: "Start",
    render: (loan) => (
      <CellStack
        primary={formatDateOnly(loan.startDate)}
        secondary={`ends ${formatDateOnly(loan.endDate)}`}
      />
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (loan) => (
      <Badge tone={LOAN_STATUS_TONE[loan.status]}>{labelForEnumValue(loan.status)}</Badge>
    ),
  },
];

export const LOAN_FILTERS: MultiFilter[] = [
  { key: "status", label: "Status", options: LOAN_STATUS_OPTIONS },
  { key: "loanType", label: "Loan type", options: LOAN_TYPE_OPTIONS },
];

export const LOAN_SORT_OPTIONS = sortOptions(LOAN_SORTS);

export const loanSummaryTiles = (summary: LoansSummary | null): SummaryTile[] => {
  if (!summary) {
    return [];
  }

  return [
    { label: "Total principal", value: formatPaise(summary.totalPrincipal) },
    { label: "Total EMI", value: formatPaise(summary.totalEmi) },
    { label: "Loans", value: String(summary.totalLoans), subValue: `${summary.activeLoans} active` },
    { label: "Closed", value: String(summary.closedLoans) },
  ];
};