"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { getIncomeTaxCalculationsByIds } from "@/services/incomeTax/calculations";
import { projectIncomeTaxScenario } from "@/components/IncomeTax/helpers/incomeTaxScenario";
import type { IncomeTaxScenarioProjection } from "@/components/IncomeTax/helpers/incomeTaxScenario";
import type { Budget } from "@/types/ConfigTypes";
import type { Income } from "@/types/FinanceTypes";

/**
 * An income's figures, whichever kind of income it is.
 *
 * A hand-recorded income answers from itself; an imported one answers from the saved scenario it
 * points at. Handing every caller the same shape is what stops the difference leaking into
 * screens that only want to draw a table.
 */
export type ResolvedIncome = {
  /**
   * Integer paise, or `null` when the scenario — or the budget behind it — could not be read.
   * Never zero: a zero is a claim the income was worth nothing.
   */
  amount: number | null;
  /** Integer paise, or `null` on an imported income whose scenario could not be read. */
  taxPaid: number | null;
  /** The scenario's year, for showing which year an imported figure belongs to. */
  scenarioLabel: string | null;
  isImported: boolean;
};

export type ImportedIncomeFigures = {
  figuresFor: (income: Income) => ResolvedIncome;
  isResolving: boolean;
  /** Imported incomes whose figures could not be read at all. */
  unresolved: number;
};

/** Whether this income reads its figures from a saved scenario. */
export const isImportedIncome = (income: Income): boolean =>
  typeof income.incomeTaxCalculationId === "string" && income.incomeTaxCalculationId.length > 0;

/**
 * Resolves every imported income on a page, in one request.
 *
 * One for the scenarios the rows point at. Doing it lazily and only when there is something to
 * resolve means a page of ordinary incomes costs nothing extra.
 *
 * The figures are **not** read at the row's own month the way a loan instalment is — an income
 * carries no instalment schedule. It is the scenario's own figures, which are fixed at the year
 * the scenario was saved for.
 */
export const useImportedIncomeFigures = (
  incomes: Income[],
  budgets: Budget[],
  reloadToken = 0
): ImportedIncomeFigures => {
  const { authorisedRequest } = useAuth();
  const [resolved, setResolved] = useState<Record<string, ResolvedIncome>>({});
  const [unresolved, setUnresolved] = useState(0);
  const [isResolving, setIsResolving] = useState(false);

  const importedOnes = useMemo(() => incomes.filter(isImportedIncome), [incomes]);

  /**
   * The scenario ids on this page, as a comma-joined string.
   *
   * A string rather than the array itself, so the effect re-runs when the *set* changes and not
   * every time a caller hands over a new array holding the same ones.
   */
  const scenarioKey = useMemo(
    () =>
      [...new Set(importedOnes.map((income) => income.incomeTaxCalculationId as string))]
        .sort()
        .join(","),
    [importedOnes]
  );

  // The budgets are config, and a re-read of the same scenarios against different budgets is a
  // different answer, so they are part of the effect's inputs rather than read from a closure.
  const budgetKey = budgets.map((budget) => `${budget.assessmentYear}:${budget.regime}`).join(",");

  useEffect(() => {
    if (scenarioKey.length === 0) {
      setResolved({});
      setUnresolved(0);
      return;
    }

    let cancelled = false;
    const ids = scenarioKey.split(",");

    const run = async () => {
      setIsResolving(true);

      try {
        const scenarios = await getIncomeTaxCalculationsByIds(authorisedRequest, ids);

        if (cancelled) {
          return;
        }

        const next: Record<string, ResolvedIncome> = {};
        let missing = 0;

        for (const income of importedOnes) {
          const scenario = scenarios[income.incomeTaxCalculationId as string];

          // A scenario that is gone, or one whose budget is no longer in the config, cannot be
          // valued. Counted rather than silently dropped, so a screen can say so instead of
          // showing a dash and letting the user guess.
          if (!scenario) {
            missing += 1;
            continue;
          }

          const projection: IncomeTaxScenarioProjection | null = projectIncomeTaxScenario(
            scenario,
            budgets
          );

          if (!projection) {
            missing += 1;
            continue;
          }

          next[income.id] = {
            amount: projection.annualIncome,
            taxPaid: projection.tax,
            scenarioLabel: `AY ${projection.assessmentYear}`,
            isImported: true,
          };
        }

        setResolved(next);
        setUnresolved(missing);
      } catch {
        if (!cancelled) {
          // A failed read must not blank out the incomes that carry their own figures; only the
          // imported ones lose theirs.
          setResolved({});
          setUnresolved(importedOnes.length);
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
    // `scenarioKey` stands in for `importedOnes`: the same set, compared by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorisedRequest, budgetKey, budgets, reloadToken, scenarioKey]);

  const figuresFor = useCallback(
    (income: Income): ResolvedIncome => {
      const fromScenario = resolved[income.id];

      if (fromScenario) {
        return fromScenario;
      }

      return {
        amount: income.amount,
        taxPaid: income.taxPaid,
        scenarioLabel: null,
        isImported: isImportedIncome(income),
      };
    },
    [resolved]
  );

  return { figuresFor, isResolving, unresolved };
};