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
import type { Loan } from "@/types/FinanceTypes";
import type { ResolvedLoan } from "@/components/Loans/useImportedLoanFigures";
import type { LoanTotals } from "@/components/Loans/useLoanTotals";

/**
 * Reads a loan's own stored figures, for an import whose calculation is not available.
 *
 * Also the right answer before any calculation has been read, so a screen of ordinary loans
 * never waits on a request it does not need.
 */
const storedFigures = (loan: Loan): ResolvedLoan => ({
  principal: loan.principal,
  interestRate: loan.interestRate,
  emiAmount: loan.emiAmount,
  tenureMonths: loan.tenureMonths,
  startDate: loan.startDate,
  endDate: loan.endDate,
  activeMonth: null,
  isImported: loan.loanCalculationId !== null,
});

/**
 * Everything that makes the loans screen its own screen.
 *
 * Note what is absent: there is no outstanding balance and no payoff figure.
 * The API has no repayment ledger, so any such number would be invented rather
 * than read. Only what the record stores is shown.
 */
export const LOAN_FIELDS: FieldConfig[] = [
  { kind: "text", name: "title", label: "title", required: true, minLength: 1, maxLength: 150 },
  { kind: "text", name: "lender", label: "lender", required: true, minLength: 1, maxLength: 120 },
  { kind: "select", name: "loanType", label: "loan type", required: true, options: LOAN_TYPE_OPTIONS },
  { kind: "money", name: "principal", label: "principal", required: true },
  { kind: "percent", name: "interestRate", label: "interest rate", required: true },
  { kind: "select", name: "interestType", label: "interest type", required: true, options: INTEREST_TYPE_OPTIONS },
  { kind: "date", name: "startDate", label: "start date", required: true },
  { kind: "date", name: "endDate", label: "end date", required: true },
  { kind: "money", name: "emiAmount", label: "EMI amount" },
  { kind: "number", name: "emiDay", label: "EMI day", min: 1, max: 28 },
  { kind: "number", name: "tenureMonths", label: "tenure (months)", min: 1, max: 600 },
  {
    kind: "money",
    name: "undisbursedAmount",
    label: "undisbursed amount",
  },
  { kind: "select", name: "status", label: "status", options: LOAN_STATUS_OPTIONS },
  { kind: "text", name: "purpose", label: "purpose", maxLength: 300 },
  { kind: "text", name: "reference", label: "reference", maxLength: 60 },
  { kind: "text", name: "notes", label: "notes", maxLength: 2000, multiline: true },
];

/**
 * The table's columns, given a way to read a loan's figures.
 *
 * Takes the resolver rather than reading the record directly, because a loan imported from
 * a calculation holds no figures of its own — its principal, rate, EMI and end date live on
 * the calculation and are read from it at the current month. Handing every column the same
 * resolver is what keeps an imported loan and a stored one drawn identically.
 *
 * A figure that cannot be read at all — an import whose calculation was deleted — shows as a
 * dash, which is honest: there is nothing to show, and a zero would read as a loan worth
 * nothing rather than one missing its source.
 */
export const loanColumns = (
  figuresFor: (loan: Loan) => ResolvedLoan
): TableColumn<Loan>[] => [
  {
    /*
     * First, because it is the user's own name for the loan and the thing they scan a list for.
     * The lender goes under it rather than beside it: one bank issues many loans, so the bank
     * is context for the title, not a second way of identifying the row.
     */
    key: "title",
    header: "Loan",
    render: (loan) => <CellStack primary={loan.title} secondary={loan.lender} />,
  },
  { key: "loanType", header: "Type", render: (loan) => labelForEnumValue(loan.loanType) },
  {
    key: "principal",
    header: "Principal",
    numeric: true,
    render: (loan) => {
      const { principal } = figuresFor(loan);
      return principal === null ? "-" : formatPaise(principal);
    },
  },
  {
    key: "emi",
    header: "EMI",
    numeric: true,
    render: (loan) => {
      const { emiAmount } = figuresFor(loan);
      return emiAmount ? formatPaise(emiAmount) : "-";
    },
  },
  {
    key: "rate",
    header: "Rate",
    numeric: true,
    render: (loan) => {
      const { interestRate } = figuresFor(loan);
      return interestRate === null ? "-" : formatPercent(interestRate);
    },
  },
  {
    key: "dates",
    header: "Start",
    render: (loan) => {
      const { startDate, endDate } = figuresFor(loan);
      return (
        <CellStack
          primary={formatDateOnly(startDate)}
          secondary={endDate ? `ends ${formatDateOnly(endDate)}` : undefined}
        />
      );
    },
  },
  {
    key: "status",
    header: "Status",
    render: (loan) => (
      <Badge tone={LOAN_STATUS_TONE[loan.status]}>{labelForEnumValue(loan.status)}</Badge>
    ),
  },
];

/**
 * The columns used when nothing can resolve a loan — the first render, before the
 * calculations arrive. Reads each loan's own figures, so a screen of ordinary loans draws
 * completely before any request completes.
 */
export const LOAN_COLUMNS: TableColumn<Loan>[] = loanColumns(storedFigures);

export const LOAN_FILTERS: MultiFilter[] = [
  { key: "status", label: "Status", options: LOAN_STATUS_OPTIONS },
  { key: "loanType", label: "Loan type", options: LOAN_TYPE_OPTIONS },
];

export const LOAN_SORT_OPTIONS = sortOptions(LOAN_SORTS);

/**
 * The tiles above the loans table.
 *
 * Totals are summed in the browser rather than taken from the API's aggregate: an imported
 * loan stores no principal and no EMI, so a server total would omit every one of them. Each
 * import is resolved against its calculation first, which is what puts it back into the sum.
 */
export const loanSummaryTiles = (
  totals: LoanTotals,
  isResolving: boolean
): SummaryTile[] => {
  if (totals.isLoading) {
    return [];
  }

  const tiles: SummaryTile[] = [
    { label: "Total principal", value: formatPaise(totals.totalPrincipal) },
    { label: "Total EMI", value: formatPaise(totals.totalEmi) },
    {
      label: "Loans",
      value: String(totals.totalLoans),
      subValue: `${totals.activeLoans} active`,
    },
    { label: "Closed", value: String(totals.closedLoans) },
  ];

  // Said only when there is something to say: a tile reading "0 imported" on a screen with
  // none is noise, and one that silently omits imported loans from a total is misleading.
  if (totals.importedLoans > 0) {
    tiles.push({
      label: "Imported",
      value: String(totals.importedLoans),
      subValue: totals.unresolved > 0
        ? `${totals.unresolved} could not be read`
        : "from saved calculations",
    });
  }

  if (isResolving) {
    tiles.push({ label: "Resolving", value: "…", subValue: "reading calculations" });
  }

  return tiles;
};