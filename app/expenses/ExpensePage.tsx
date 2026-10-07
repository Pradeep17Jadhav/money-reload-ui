"use client";

import { todayAsDateOnly } from "@/helpers/dates";
import RecordsPage from "@/components/Records/RecordsPage/RecordsPage";
import { useRecordCollection } from "@/hooks/Finance/useRecordCollection";
import { useRecordSummary } from "@/hooks/Finance/useRecordSummary";
import { useRecordsScreen } from "@/hooks/Finance/useRecordsScreen";
import {
  createExpense,
  deleteExpense,
  getExpensesSummary,
  listExpenses,
  updateExpense,
} from "@/services/finance/records";
import type { Expense } from "@/types/FinanceTypes";
import {
  EXPENSE_COLUMNS,
  EXPENSE_FIELDS,
  EXPENSE_FILTERS,
  EXPENSE_SORT_OPTIONS,
  expenseSummaryTiles,
} from "@/components/Expenses/ExpenseConfig";

const ExpensePage = () => {
  const collection = useRecordCollection<Expense>({
    list: listExpenses,
    remove: deleteExpense,
  });

  const screen = useRecordsScreen<Expense>({
    fields: EXPENSE_FIELDS,
    // Local calendar date, not `toISOString`, which shifts the day west of UTC.
    createDefaults: { date: todayAsDateOnly() },
    recordToValues: (expense) => expense as unknown as Record<string, unknown>,
    getId: (expense) => expense.id,
    create: createExpense,
    update: updateExpense,
    remove: deleteExpense,
    onMutated: collection.refetch,
  });

  const { summary, isLoading, error } = useRecordSummary(getExpensesSummary, collection.query, collection.reloadToken);

  return (
    <RecordsPage
      title="Expenses"
      subtitle="Everything going out, and whether it was essential."
      addLabel="Add expense"
      submitLabel="add expense"
      editSubmitLabel="save changes"
      emptyMessage="No expenses recorded yet. Add your first one to see what is going out."
      caption="expense"
      deleteMessage="This expense will be removed from your records and from every total. It cannot be undone from here."
      columns={EXPENSE_COLUMNS}
      sortOptions={EXPENSE_SORT_OPTIONS}
      filters={EXPENSE_FILTERS}
      summaryTiles={expenseSummaryTiles(summary)}
      summaryError={error}
      isSummaryLoading={isLoading}
      collection={collection}
      screen={screen}
    />
  );
};

export default ExpensePage;