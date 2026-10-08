"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { getCalculationsByIds } from "@/services/loan/calculations";
import { projectLoanCalculation } from "@/components/Loans/helpers/loanProjection";
import type { LoanProjection } from "@/components/Loans/helpers/loanProjection";
import type { Loan } from "@/types/FinanceTypes";

export type ImportedLoanFigures = {
  /**
   * The figures a loan shows, whichever kind of loan it is.
   *
   * A stored loan is returned with its own values, so a caller never has to branch on
   * whether a loan is imported before reading it. That is the whole point: the difference
   * between the two kinds is an implementation detail of where the numbers came from, not
   * something every screen should have to know about.
   */
  figuresFor: (loan: Loan) => ResolvedLoan;
  /** True while the imported loans' calculations are still being read. */
  isResolving: boolean;
  /**
   * Imported loans whose calculation could not be read — deleted, or belonging to someone
   * else. Reported rather than hidden, so a row with no figures says why.
   */
  unresolved: number;
};

export type ResolvedLoan = {
  principal: number | null;
  interestRate: number | null;
  emiAmount: number | null;
  tenureMonths: number | null;
  /** `YYYY-MM-DD`, or null for an imported loan whose calculation could not be read. */
  endDate: string | null;
  startDate: string;
  /**
   * The month the figures were read for, as `YYYY-MM`.
   *
   * Null for a loan that stores its own figures: it has no schedule, so there is no month to
   * clamp into, and its instalment is simply the one on the record — due this month.
   */
  activeMonth: string | null;
  /** True when the figures come from a calculation rather than the record. */
  isImported: boolean;
};

/**
 * Resolves every imported loan on a page in a single request.
 *
 * Only the loans that actually reference a calculation produce a request, so a list of
 * ordinary loans costs nothing. The response is keyed by loan id, which is what the table
 * and the totals both read.
 *
 * A calculation that has been deleted leaves its loan unresolvable rather than showing the
 * record's own (empty) figures: an imported loan has no figures of its own to fall back to,
 * and showing zeros would read as a loan worth nothing rather than one missing its source.
 */
export const useImportedLoanFigures = (
    loans: Loan[],
    reloadToken: number
): ImportedLoanFigures => {
    const { authorisedRequest } = useAuth();
    const [projections, setProjections] = useState<
        Record<string, LoanProjection>
    >({});
    const [missing, setMissing] = useState<string[]>([]);
    const [isResolving, setIsResolving] = useState(false);

    // Distinct, stable key so the effect below does not re-run on every render of a new
    // array instance holding the same loans.
    const imported = useMemo(
        () =>
            loans.filter(
                (loan) => typeof loan.loanCalculationId === "string"
            ),
        [loans]
    );
    const importedKey = useMemo(
        () =>
            [...new Set(imported.map((loan) => loan.loanCalculationId as string))]
                .sort()
                .join(","),
        [imported]
    );

    useEffect(() => {
        if (importedKey.length === 0) {
            setProjections({});
            setMissing([]);
            return;
        }

        let cancelled = false;

        const run = async () => {
            setIsResolving(true);

            try {
                const calculations = await getCalculationsByIds(
                    authorisedRequest,
                    importedKey.split(",")
                );

                if (cancelled) {
                    return;
                }

                const resolved: Record<string, LoanProjection> = {};
                const unresolvedIds: string[] = [];

                for (const loan of imported) {
                    const calculation =
                        calculations[loan.loanCalculationId as string];
                    const projection = calculation
                        ? projectLoanCalculation(calculation)
                        : null;

                    if (projection) {
                        resolved[loan.id] = projection;
                    } else {
                        unresolvedIds.push(loan.id);
                    }
                }

                setProjections(resolved);
                setMissing(unresolvedIds);
            } catch {
                if (!cancelled) {
                    // A failed read must not blank out the loans that carry their own
                    // figures; only the imported ones lose them.
                    setProjections({});
                    setMissing(imported.map((loan) => loan.id));
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
        // `importedKey` stands in for `imported`: it is the same set of ids, in a form that
        // compares by value rather than by array identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authorisedRequest, importedKey, reloadToken]);

    const figuresFor = useCallback(
        (loan: Loan): ResolvedLoan => {
            const projection = projections[loan.id];

            if (projection) {
                return {
                    principal: projection.principal,
                    interestRate: projection.interestRate,
                    emiAmount: projection.emi,
                    tenureMonths: projection.tenureMonths,
                    startDate: projection.startMonth.format("YYYY-MM-01"),
                    endDate: projection.endMonth.format("YYYY-MM-01"),
                    activeMonth: projection.activeMonth.format("YYYY-MM"),
                    isImported: true,
                };
            }

            return {
                principal: loan.principal,
                interestRate: loan.interestRate,
                emiAmount: loan.emiAmount,
                tenureMonths: loan.tenureMonths,
                startDate: loan.startDate,
                // Null rather than the stored value for an imported loan that lost its
                // calculation: the record never held a real end date to show.
                endDate: isImportedLoan(loan) ? null : loan.endDate,
                activeMonth: null,
                isImported: isImportedLoan(loan),
            };
        },
        [projections]
    );

    return {
        figuresFor,
        isResolving,
        unresolved: missing.length,
    };
};

/** Whether this loan reads its figures from a calculation. */
export const isImportedLoan = (loan: Loan): boolean =>
    typeof loan.loanCalculationId === "string" && loan.loanCalculationId.length > 0;
