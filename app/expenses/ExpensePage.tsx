"use client";

import { useCallback, useState } from "react";
import { todayAsDateOnly } from "@/helpers/dates";
import RecordsPage from "@/components/Records/RecordsPage/RecordsPage";
import LoanExpenseDialog from "@/components/Expenses/LoanExpenseDialog/LoanExpenseDialog";
import { useRecordCollection } from "@/hooks/Finance/useRecordCollection";
import { useRecordsScreen } from "@/hooks/Finance/useRecordsScreen";
import { useLinkedExpenseFigures } from "@/components/Expenses/useLinkedExpenseFigures";
import { useExpenseTotals } from "@/components/Expenses/useExpenseTotals";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from "@/services/finance/records";
import type { Expense } from "@/types/FinanceTypes";
import {
  EXPENSE_FIELDS,
  EXPENSE_FILTERS,
  EXPENSE_SORT_OPTIONS,
  expenseColumns,
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

  const { figuresFor } = useLinkedExpenseFigures(
    collection.items,
    collection.reloadToken
  );
  const totals = useExpenseTotals(collection.reloadToken);

  /*
   * The loan-instalment dialog, used for both creating one and editing an existing linked
   * expense. A generic "edit expense" would offer amount, category and loan type on a record
   * that owns none of them, and either fail or drop them silently — so a linked expense opens
   * this instead, and shows the loan's figures rather than letting them be overridden.
   */
  const [loanDialog, setLoanDialog] = useState<{
    isOpen: boolean;
    expense: Expense | null;
  }>({ isOpen: false, expense: null });

  const openLoanDialog = useCallback(() => {
    setLoanDialog({ isOpen: true, expense: null });
  }, []);

  const closeLoanDialog = useCallback(() => {
    setLoanDialog({ isOpen: false, expense: null });
  }, []);

  const onRowEdit = useCallback((expense: Expense) => {
    if (typeof expense.loanId !== "string" || expense.loanId.length === 0) {
      // Not linked: the generic form is right for it, since every field is its own.
      return false;
    }

    setLoanDialog({ isOpen: true, expense });

    return true;
  }, []);

  return (
    <>
      <RecordsPage
        title="Expenses"
        subtitle="Everything going out, and whether it was essential."
        addLabel="Add expense"
        secondaryAction={{ label: "Loan instalment", onClick: openLoanDialog }}
        submitLabel="add expense"
        editSubmitLabel="save changes"
        emptyMessage="No expenses recorded yet. Add your first one to see what is going out."
        caption="expense"
        deleteMessage="This expense will be removed from your records and from every total. It cannot be undone from here."
        columns={expenseColumns(figuresFor)}
        sortOptions={EXPENSE_SORT_OPTIONS}
        filters={EXPENSE_FILTERS}
        summaryTiles={expenseSummaryTiles(totals)}
        summaryError={totals.error}
        isSummaryLoading={totals.isLoading}
        collection={collection}
        screen={screen}
        onRowEdit={onRowEdit}
      />

      <LoanExpenseDialog
        open={loanDialog.isOpen}
        expense={loanDialog.expense}
        onClose={closeLoanDialog}
        onSaved={collection.refetch}
      />
    </>
  );
};

export default ExpensePage;