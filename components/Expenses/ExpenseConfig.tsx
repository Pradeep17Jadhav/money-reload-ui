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
import type { Expense } from "@/types/FinanceTypes";
import type { ResolvedExpense } from "@/components/Expenses/useLinkedExpenseFigures";

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

/**
 * The table's columns, given a way to read an expense's figures.
 *
 * Takes the resolver rather than reading the record directly, because an expense linked to a
 * loan stores no amount of its own — it is read from that loan's amortisation at the expense's
 * own month. Handing every column the same resolver is what keeps a linked expense and a
 * hand-recorded one drawn identically.
 *
 * A figure that cannot be read shows as a dash, which is honest: there is nothing to show, and
 * a zero would read as a free expense rather than one missing its source.
 */
export const expenseColumns = (
  figuresFor: (expense: Expense) => ResolvedExpense
): TableColumn<Expense>[] => [
  {
    key: "title",
    header: "Expense",
    render: (expense) => {
      const { lender } = figuresFor(expense);

      return (
        <CellStack
          primary={expense.title}
          secondary={
            lender ??
            (expense.isRecurring && expense.recurrenceFrequency
              ? expense.recurrenceFrequency
              : undefined)
          }
        />
      );
    },
  },
  {
    key: "category",
    header: "Category",
    render: (expense) => {
      const { category } = figuresFor(expense);

      return category === null ? "-" : labelForEnumValue(category);
    },
  },
  { key: "date", header: "Date", render: (expense) => formatDateOnly(expense.date) },
  {
    key: "amount",
    header: "Amount",
    numeric: true,
    render: (expense) => {
      const { amount } = figuresFor(expense);

      return amount === null ? "-" : formatPaise(amount);
    },
  },
  {
    key: "essential",
    header: "Essential",
    render: (expense) => (expense.isEssential ? <Badge tone="success">essential</Badge> : <Badge>optional</Badge>),
  },
  { key: "paymentMode", header: "Mode", render: (expense) => labelForEnumValue(expense.paymentMode) },
  {
    key: "merchant",
    header: "Merchant",
    render: (expense) => expense.merchant ?? "-",
  },
];

/**
 * The columns used before anything has been resolved — a page of ordinary expenses draws in
 * full with no request at all, because each row answers from itself.
 */
const storedFigures = (expense: Expense): ResolvedExpense => ({
  amount: expense.amount,
  category: expense.category,
  installmentType: expense.installmentType,
  lender: null,
  isImported: expense.loanId !== null,
});

export const EXPENSE_COLUMNS: TableColumn<Expense>[] = expenseColumns(storedFigures);

export const EXPENSE_FILTERS: MultiFilter[] = [
  { key: "category", label: "Category", options: EXPENSE_CATEGORY_OPTIONS },
  { key: "paymentMode", label: "Payment mode", options: PAYMENT_MODE_OPTIONS },
];

export const EXPENSE_SORT_OPTIONS = sortOptions(EXPENSE_SORTS);

export type ExpenseTotals = {
  totalExpense: number;
  essentialTotal: number;
  nonEssentialTotal: number;
  recordCount: number;
  /** Linked expenses, whose amounts come from a loan rather than the record. */
  linkedExpenses: number;
  /** Of those, how many could not be read at all. */
  unresolved: number;
  isLoading: boolean;
  error: string | null;
};

/**
 * The tiles above the expenses table.
 *
 * Summed in the browser rather than read from the API's aggregate: a linked expense stores no
 * amount, so a server total would omit every one of them. Each is resolved against its loan
 * first, which is what puts them back in — the same reason the loans tiles moved client-side.
 */
export const expenseSummaryTiles = (totals: ExpenseTotals): SummaryTile[] => {
  if (totals.isLoading) {
    return [];
  }

  const tiles: SummaryTile[] = [
    { label: "Total expenses", value: formatPaise(totals.totalExpense) },
    { label: "Essential", value: formatPaise(totals.essentialTotal) },
    { label: "Non-essential", value: formatPaise(totals.nonEssentialTotal) },
    {
      label: "Records",
      value: String(totals.recordCount),
      subValue:
        totals.recordCount === 0
          ? undefined
          : `average ${formatPaise(Math.floor(totals.totalExpense / totals.recordCount))}`,
    },
  ];

  // Said only when there is something to say: a tile reading "0 from loans" on a screen with
  // none is noise, and a total that quietly omits them is misleading.
  if (totals.linkedExpenses > 0) {
    tiles.push({
      label: "From loans",
      value: String(totals.linkedExpenses),
      subValue:
        totals.unresolved > 0
          ? `${totals.unresolved} could not be read`
          : "instalments from linked loans",
    });
  }

  return tiles;
};