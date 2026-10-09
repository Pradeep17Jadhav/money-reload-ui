import { formatDateOnly } from "@/helpers/dates";
import { formatPaise } from "@/helpers/money";
import { Badge, CellStack } from "@/components/Records/RecordTable/RecordTable";
import type { TableColumn } from "@/components/Records/RecordTable/RecordTable";
import {
  DESTINATION_OPTIONS,
  INCOME_CATEGORY_OPTIONS,
  INCOME_SORTS,
  labelForEnumValue,
  PAYMENT_MODE_OPTIONS,
  RECURRENCE_OPTIONS,
  sortOptions,
} from "@/constants/records";
import type { MultiFilter } from "@/components/Records/RecordToolbar/RecordToolbar";
import type { SummaryTile } from "@/components/Records/SummaryTiles/SummaryTiles";
import type { FieldConfig } from "@/types/RecordFormTypes";
import type { ResolvedIncome } from "@/hooks/Income/useImportedIncomeFigures";
import type { Income, IncomesSummary } from "@/types/FinanceTypes";

export const INCOME_FIELDS: FieldConfig[] = [
  { kind: "text", name: "source", label: "source", required: true, minLength: 1, maxLength: 120 },
  { kind: "money", name: "amount", label: "amount", required: true },
  { kind: "date", name: "date", label: "date", required: true },
  { kind: "select", name: "category", label: "category", required: true, options: INCOME_CATEGORY_OPTIONS },
  { kind: "select", name: "paymentMode", label: "payment mode", required: true, options: PAYMENT_MODE_OPTIONS },
  { kind: "text", name: "payer", label: "payer", maxLength: 120 },
  { kind: "select", name: "destination", label: "destination", options: DESTINATION_OPTIONS },
  { kind: "money", name: "taxPaid", label: "tax paid", allowZero: true },
  { kind: "switch", name: "isRecurring", label: "This is a recurring income" },
  {
    kind: "select",
    name: "recurrenceFrequency",
    label: "recurrence frequency",
    required: true,
    options: RECURRENCE_OPTIONS,
    visibleWhen: { name: "isRecurring", equals: true },
  },
  { kind: "text", name: "reference", label: "reference", maxLength: 60 },
  { kind: "text", name: "reason", label: "reason", maxLength: 300 },
  { kind: "text", name: "notes", label: "notes", maxLength: 2000, multiline: true },
];

/**
 * The columns, given a way to read an income's figures.
 *
 * An imported income stores neither an amount nor a tax — both belong to the scenario it points at
 * — so the table reads them through the resolver rather than off the record. Taking them straight
 * off the record would print a dash for every imported row and read as an income worth nothing.
 *
 * Exported as a function for that reason, which is the shape the loans and investments tables
 * already take.
 */
export const incomeColumns = (
  figuresFor: (income: Income) => ResolvedIncome
): TableColumn<Income>[] => [
  {
    key: "source",
    header: "Source",
    render: (income) => {
      const { scenarioLabel } = figuresFor(income);

      return (
        <CellStack
          primary={income.source}
          secondary={
            scenarioLabel ??
            (income.isRecurring && income.recurrenceFrequency
              ? income.recurrenceFrequency
              : undefined)
          }
        />
      );
    },
  },
  { key: "category", header: "Category", render: (income) => labelForEnumValue(income.category) },
  { key: "date", header: "Date", render: (income) => formatDateOnly(income.date) },
  {
    key: "amount",
    header: "Amount",
    numeric: true,
    render: (income) => {
      const { amount } = figuresFor(income);

      // A dash rather than a zero: there is not enough stored to say, which is a different and
      // wrong answer from an income worth nothing.
      return amount === null ? "-" : formatPaise(amount);
    },
  },
  {
    key: "taxPaid",
    header: "Tax",
    numeric: true,
    render: (income) => {
      const { taxPaid } = figuresFor(income);

      return taxPaid ? formatPaise(taxPaid) : "-";
    },
  },
  { key: "paymentMode", header: "Mode", render: (income) => labelForEnumValue(income.paymentMode) },
  {
    key: "destination",
    header: "Destination",
    render: (income) => <Badge>{labelForEnumValue(income.destination)}</Badge>,
  },
];

/**
 * The columns used when nothing can resolve an income — the first render, before the scenarios
 * arrive. Reads each income's own figures, so a screen of recorded incomes draws completely
 * before any request completes.
 */
export const INCOME_COLUMNS = incomeColumns((income) => ({
  amount: income.amount,
  taxPaid: income.taxPaid,
  scenarioLabel: null,
  isImported: false,
}));

export const INCOME_FILTERS: MultiFilter[] = [
  { key: "category", label: "Category", options: INCOME_CATEGORY_OPTIONS },
  { key: "paymentMode", label: "Payment mode", options: PAYMENT_MODE_OPTIONS },
];

export const INCOME_SORT_OPTIONS = sortOptions(INCOME_SORTS);

export const incomeSummaryTiles = (summary: IncomesSummary | null): SummaryTile[] => {
  if (!summary) {
    return [];
  }

  return [
    { label: "Total income", value: formatPaise(summary.totalIncome) },
    { label: "Records", value: String(summary.recordCount) },
    { label: "Average", value: formatPaise(summary.averageIncome) },
    {
      label: "Top category",
      value: summary.byCategory[0]
        ? summary.byCategory[0].category
        : "-",
      subValue: summary.byCategory[0] ? formatPaise(summary.byCategory[0].totalAmount) : undefined,
    },
  ];
};