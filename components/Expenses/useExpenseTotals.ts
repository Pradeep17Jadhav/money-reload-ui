"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { listExpenses } from "@/services/finance/records";
import { MAX_PAGE_LIMIT } from "@/constants/records";
import { useLinkedExpenseFigures } from "@/components/Expenses/useLinkedExpenseFigures";
import type { ExpenseTotals } from "@/components/Expenses/ExpenseConfig";
import type { Expense } from "@/types/FinanceTypes";

const EMPTY: ExpenseTotals = {
  totalExpense: 0,
  essentialTotal: 0,
  nonEssentialTotal: 0,
  recordCount: 0,
  linkedExpenses: 0,
  unresolved: 0,
  isLoading: true,
  error: null,
};

/**
 * Totals computed in the browser, across every expense the user holds.
 *
 * The API's own summary sums *stored* amounts, and a linked expense stores none — its amount
 * is read from that loan's amortisation at the expense's own month. A total taken from the
 * server would omit every linked expense, so these are summed from the expenses themselves with
 * each link resolved first.
 *
 * Capped at {@link MAX_PAGE_LIMIT} expenses, the same ceiling the API enforces. Above that the
 * tile covers the first hundred; the record count sits beside it, so a shortfall is visible
 * rather than inferred.
 */
export const useExpenseTotals = (reloadToken = 0): ExpenseTotals => {
  const { authorisedRequest } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoadingList(true);
      setError(null);

      try {
        const { items } = await listExpenses(authorisedRequest, {
          limit: MAX_PAGE_LIMIT,
        });

        if (!cancelled) {
          setExpenses(items);
        }
      } catch (thrown) {
        if (!cancelled) {
          setExpenses([]);
          setError(
            thrown instanceof Error
              ? thrown.message
              : "We could not read your expenses."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingList(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authorisedRequest, reloadToken]);

  const { figuresFor, unresolved } = useLinkedExpenseFigures(expenses, reloadToken);

  const totals = useMemo<ExpenseTotals>(() => {
    if (isLoadingList) {
      return EMPTY;
    }

    let totalExpense = 0;
    let essentialTotal = 0;
    let linkedExpenses = 0;

    for (const expense of expenses) {
      const figures = figuresFor(expense);

      if (figures.isImported) {
        linkedExpenses += 1;
      }

      // An unreadable linked expense adds nothing. It is counted in `unresolved` instead, so
      // the total that is short says how much of itself is missing rather than looking complete.
      const amount = figures.amount ?? 0;
      totalExpense += amount;

      if (expense.isEssential) {
        essentialTotal += amount;
      }
    }

    return {
      totalExpense,
      essentialTotal,
      // Derived rather than summed separately, so the two parts cannot disagree with the whole.
      nonEssentialTotal: totalExpense - essentialTotal,
      recordCount: expenses.length,
      linkedExpenses,
      unresolved,
      isLoading: false,
      error,
    };
  }, [error, expenses, figuresFor, isLoadingList, unresolved]);

  return totals;
};