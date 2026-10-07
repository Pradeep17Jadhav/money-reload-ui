import { formatDateOnly } from "@/helpers/dates";
import { formatPaise } from "@/helpers/money";
import { Badge, CellStack } from "@/components/Records/RecordTable/RecordTable";
import type { TableColumn } from "@/components/Records/RecordTable/RecordTable";
import {
  DESTINATION_OPTIONS,
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_SORTS,
  INSTALLMENT_TYPE_OPTIONS,
  labelForEnumValue,
  PAYMENT_MODE_OPTIONS,
  RECURRENCE_OPTIONS,
  sortOptions,
} from "@/constants/records";
import type { MultiFilter } from "@/components/Records/RecordToolbar/RecordToolbar";
import type { SummaryTile } from "@/components/Records/SummaryTiles/SummaryTiles";
import type { FieldConfig } from "@/types/RecordFormTypes";
import type { Expense, ExpensesSummary } from "@/types/FinanceTypes";

export const EXPENSE_FIELDS: FieldConfig[] = [
  { kind: "text", name: "title", label: "title", required: true, minLength: 1, maxLength: 150 },
  { kind: "money", name: "amount", label: "amount", required: true },
  { kind: "date", name: "date", label: "date", required: true },
  {
    kind: "select",
    name: "category",
    label: "category",
    required: true,
    options: EXPENSE_CATEGORY_OPTIONS,
  },
  {
    kind: "select",
    name: "installmentType",
    label: "loan type",
    required: true,
    options: INSTALLMENT_TYPE_OPTIONS,
    // Only meaningful for an instalment, and required once that is chosen.
    visibleWhen: { name: "category", equals: "installment" },
    helper: "Which loan this instalment pays down.",
  },
  { kind: "select", name: "paymentMode", label: "payment mode", required: true, options: PAYMENT_MODE_OPTIONS },
  { kind: "text", name: "merchant", label: "merchant", maxLength: 120 },
  { kind: "select", name: "destination", label: "destination", options: DESTINATION_OPTIONS },
  { kind: "switch", name: "isEssential", label: "This is an essential expense" },
  { kind: "switch", name: "isRecurring", label: "This is a recurring expense" },
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

export const EXPENSE_COLUMNS: TableColumn<Expense>[] = [
  {
    key: "title",
    header: "Expense",
    render: (expense) => (
      <CellStack
        primary={expense.title}
        secondary={expense.isRecurring && expense.recurrenceFrequency ? expense.recurrenceFrequency : undefined}
      />
    ),
  },
  { key: "category", header: "Category", render: (expense) => labelForEnumValue(expense.category) },
  { key: "date", header: "Date", render: (expense) => formatDateOnly(expense.date) },
  { key: "amount", header: "Amount", numeric: true, render: (expense) => formatPaise(expense.amount) },
  {
    key: "essential",
    header: "Essential",
    render: (expense) => (expense.isEssential ? <Badge tone="success">essential</Badge> : <Badge>optional</Badge>),
  },
  {
    key: "installmentType",
    header: "Loan type",
    // Empty for every category that is not an instalment.
    render: (expense) => (expense.installmentType ? labelForEnumValue(expense.installmentType) : "-"),
  },
  { key: "paymentMode", header: "Mode", render: (expense) => labelForEnumValue(expense.paymentMode) },
  {
    key: "merchant",
    header: "Merchant",
    render: (expense) => expense.merchant ?? "-",
  },
];

export const EXPENSE_FILTERS: MultiFilter[] = [
  { key: "category", label: "Category", options: EXPENSE_CATEGORY_OPTIONS },
  { key: "paymentMode", label: "Payment mode", options: PAYMENT_MODE_OPTIONS },
];

export const EXPENSE_SORT_OPTIONS = sortOptions(EXPENSE_SORTS);

export const expenseSummaryTiles = (summary: ExpensesSummary | null): SummaryTile[] => {
  if (!summary) {
    return [];
  }

  return [
    { label: "Total expenses", value: formatPaise(summary.totalExpense) },
    { label: "Essential", value: formatPaise(summary.essentialTotal) },
    { label: "Non-essential", value: formatPaise(summary.nonEssentialTotal) },
    {
      label: "Records",
      value: String(summary.recordCount),
      subValue: `average ${formatPaise(summary.averageExpense)}`,
    },
  ];
};