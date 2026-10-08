"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useAuth } from "@/contexts/authContext";
import { listLoans } from "@/services/finance/records";
import { getCalculationsByIds } from "@/services/loan/calculations";
import {
  projectLoanCalculation,
  projectLoanCalculationMonth,
} from "@/components/Loans/helpers/loanProjection";
import { ExpenseCategory, InstallmentType, LoanType } from "@/types/FinanceTypes";
import type { Expense, Loan } from "@/types/FinanceTypes";

/**
 * An expense's figures, whichever kind of expense it is.
 *
 * A hand-recorded expense answers from itself; a linked one answers from its loan. Handing
 * every caller the same shape is what stops the difference leaking into screens that only want
 * to draw a table.
 */
export type ResolvedExpense = {
  /** Integer paise. Null when the loan or its calculation could not be read. */
  amount: number | null;
  category: ExpenseCategory | null;
  /**
   * The loan's kind. Read but **not shown** in the table: with a linked expense the category
   * column already says "Instalment" and the name cell says which loan, so a third column
   * restating a loan type was the same fact in a second place. Kept here for callers that
   * want it, and because it is genuinely part of what a linked expense resolves.
   */
  installmentType: InstallmentType | null;
  /** The lender of the linked loan, for showing what the instalment was on. */
  lender: string | null;
  isImported: boolean;
};

export type LinkedExpenseFigures = {
  figuresFor: (expense: Expense) => ResolvedExpense;
  isResolving: boolean;
  /** Linked expenses whose figures could not be read at all. */
  unresolved: number;
};

/** A loan's kind, as the expense vocabulary for it. Every `LoanType` has an entry. */
const INSTALLMENT_TYPE_BY_LOAN_TYPE: Record<Loan["loanType"], InstallmentType> = {
  [LoanType.PERSONAL]: InstallmentType.PERSONAL,
  [LoanType.HOME]: InstallmentType.HOME,
  [LoanType.VEHICLE]: InstallmentType.VEHICLE,
  [LoanType.EDUCATION]: InstallmentType.EDUCATION,
  [LoanType.BUSINESS]: InstallmentType.BUSINESS,
  [LoanType.MORTGAGE]: InstallmentType.MORTGAGE,
  [LoanType.GOLD]: InstallmentType.GOLD,
  [LoanType.CREDIT_CARD]: InstallmentType.CREDIT_CARD,
  [LoanType.OTHER]: InstallmentType.OTHER,
};

/** Whether this expense reads its figures from a loan. */
export const isLinkedExpense = (expense: Expense): boolean =>
  typeof expense.loanId === "string" && expense.loanId.length > 0;

/**
 * Resolves every linked expense on a page, in two requests.
 *
 * One for the loans the rows point at, and one for the calculations behind whichever of those
 * loans turn out to be imported — a loan imported from a scenario has no instalment of its own,
 * so its figure has to come from that scenario's amortisation. Doing both lazily and only when
 * there is something to resolve means a page of ordinary expenses costs nothing extra.
 *
 * A linked expense's amount is read at **its own month**, taken from its `date`. Not the
 * current month: an expense dated March 2025 is that month's instalment, and charging it
 * today's would silently restate every past payment whenever the loan is re-rated.
 */
export const useLinkedExpenseFigures = (
  expenses: Expense[],
  reloadToken = 0
): LinkedExpenseFigures => {
  const { authorisedRequest } = useAuth();
  const [linked, setLinked] = useState<
    Record<string, { amount: number | null; category: ExpenseCategory; installmentType: InstallmentType }>
  >({});
  const [lenders, setLenders] = useState<Record<string, string>>({});
  const [unresolved, setUnresolved] = useState(0);
  const [isResolving, setIsResolving] = useState(false);

  const linkedOnes = useMemo(
    () => expenses.filter(isLinkedExpense),
    [expenses]
  );

  /**
   * The loan ids on this page, as a comma-joined string.
   *
   * A string rather than the array itself, so the effect below re-runs when the *set* of loans
   * changes and not every time a caller hands over a new array holding the same ones.
   */
  const loanKey = useMemo(
    () =>
      [...new Set(linkedOnes.map((expense) => expense.loanId as string))]
        .sort()
        .join(","),
    [linkedOnes]
  );

  useEffect(() => {
    if (loanKey.length === 0) {
      setLinked({});
      setLenders({});
      setUnresolved(0);

      return;
    }

    let cancelled = false;
    const ids = loanKey.split(",");

    const run = async () => {
      setIsResolving(true);

      try {
        /*
         * `listLoans` rather than a hand-built URL: this file previously assembled the path
         * itself and dropped the leading slash, so every request 404'd, the catch below
         * swallowed it, and every linked expense silently read as having no figures at all.
         * Two missing columns, no error anywhere. Letting the one helper own the path means
         * there is no second place for it to be wrong.
         */
        const { items: loansById } = await listLoans(authorisedRequest, {
          ids,
          limit: ids.length,
        });

        if (cancelled) {
          return;
        }

        const loans: Record<string, Loan> = Object.fromEntries(
          loansById.map((loan) => [loan.id, loan])
        );

        /*
         * The ids to ask the calculations route for are the *calculations* the loans point
         * at, not the loans themselves. Passing loan ids here was well-formed enough to look
         * right and returned an empty set — every loan with a calculation behind it resolved
         * to no figures, so its expense showed a dash for both amount and category.
         */
        const calculationIds = [
          ...new Set(
            Object.values(loans)
              .filter(isLoanImported)
              .map((loan) => loan.loanCalculationId as string)
          ),
        ];

        const calculations =
          calculationIds.length > 0
            ? await getCalculationsByIds(authorisedRequest, calculationIds)
            : {};

        if (cancelled) {
          return;
        }

        const resolved: typeof linked = {};
        const lenderByLoanId: Record<string, string> = {};
        let missing = 0;

        for (const expense of linkedOnes) {
          const loanId = expense.loanId as string;
          const loan = loans[loanId];

          if (loan === undefined) {
            missing += 1;

            continue;
          }

          lenderByLoanId[loanId] = loan.lender;

          /*
           * Keyed by the *calculation's* id, not the loan's. The map came back keyed by what
           * was asked for — `calculationIds`, which are calculation ids — so looking it up by
           * the loan id found nothing, and every loan with a calculation behind it silently
           * resolved to no figures at all.
           */
          const calculation =
            loan.loanCalculationId === null
              ? undefined
              : calculations[loan.loanCalculationId];

          const amount = expenseAmountAtDate(expense, loan, calculation);

          if (amount === null) {
            missing += 1;

            continue;
          }

          resolved[expense.id] = {
            amount,
            category: ExpenseCategory.INSTALLMENT,
            installmentType: INSTALLMENT_TYPE_BY_LOAN_TYPE[loan.loanType],
          };
        }

        setLinked(resolved);
        setLenders(lenderByLoanId);
        setUnresolved(missing);
      } catch {
        if (!cancelled) {
          // A failed read must not blank out the expenses that carry their own figures; only
          // the linked ones lose theirs.
          setLinked({});
          setLenders({});
          setUnresolved(linkedOnes.length);
        }
      } finally {
        if (!cancelled) {
          setIsResolving(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
    // `loanKey` stands in for `linkedOnes`: the same set of loans, compared by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorisedRequest, loanKey, reloadToken]);

  const figuresFor = useCallback(
    (expense: Expense): ResolvedExpense => {
      const resolved = linked[expense.id];

      if (resolved) {
        return {
          amount: resolved.amount,
          category: resolved.category,
          installmentType: resolved.installmentType,
          lender: lenders[expense.loanId as string] ?? null,
          isImported: true,
        };
      }

      return {
        amount: expense.amount,
        category: expense.category,
        installmentType: expense.installmentType,
        lender: null,
        isImported: isLinkedExpense(expense),
      };
    },
    [linked, lenders]
  );

  return { figuresFor, isResolving, unresolved };
};

/** Whether a loan's own figures come from a calculation rather than the record. */
const isLoanImported = (loan: Loan): boolean =>
  typeof loan.loanCalculationId === "string" && loan.loanCalculationId.length > 0;

/**
 * The instalment a linked expense is for, at the expense's own month.
 *
 * A loan that stores its own EMI has one figure and no schedule, so the month is irrelevant and
 * the stored amount is the answer. A loan imported from a scenario resolves against that
 * scenario's schedule at exactly this month — and gets nothing at all if the month is outside
 * the schedule, rather than the nearest month's figure, which would be a number for a month
 * that had no instalment.
 */
const expenseAmountAtDate = (
  expense: Expense,
  loan: Loan,
  calculation: Parameters<typeof projectLoanCalculationMonth>[0] | undefined
): number | null => {
  if (!isLoanImported(loan)) {
    return loan.emiAmount !== null && loan.emiAmount > 0 ? loan.emiAmount : null;
  }

  if (calculation === undefined) {
    return null;
  }

  const atMonth: Dayjs = dayjs(expense.date);

  // The clamped read first, then the exact one: a stored loan has no schedule to index by
  // month, and the clamping branch is what keeps both kinds on the same code path.
  if (projectLoanCalculation(calculation, atMonth) === null) {
    return null;
  }

  return projectLoanCalculationMonth(calculation, atMonth)?.emi ?? null;
};