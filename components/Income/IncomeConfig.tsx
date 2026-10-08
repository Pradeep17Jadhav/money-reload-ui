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

export const INCOME_COLUMNS: TableColumn<Income>[] = [
  {
    key: "source",
    header: "Source",
    render: (income) => (
      <CellStack
        primary={income.source}
        secondary={income.isRecurring && income.recurrenceFrequency ? income.recurrenceFrequency : undefined}
      />
    ),
  },
  { key: "category", header: "Category", render: (income) => labelForEnumValue(income.category) },
  { key: "date", header: "Date", render: (income) => formatDateOnly(income.date) },
  { key: "amount", header: "Amount", numeric: true, render: (income) => formatPaise(income.amount) },
  {
    key: "taxPaid",
    header: "Tax",
    numeric: true,
    render: (income) => (income.taxPaid ? formatPaise(income.taxPaid) : "-"),
  },
  { key: "paymentMode", header: "Mode", render: (income) => labelForEnumValue(income.paymentMode) },
  {
    key: "destination",
    header: "Destination",
    render: (income) => <Badge>{labelForEnumValue(income.destination)}</Badge>,
  },
];

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