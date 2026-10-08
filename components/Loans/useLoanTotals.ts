"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { listLoans } from "@/services/finance/records";
import { MAX_PAGE_LIMIT } from "@/constants/records";
import { useImportedLoanFigures } from "@/components/Loans/useImportedLoanFigures";
import { isImportedLoan } from "@/components/Loans/useImportedLoanFigures";
import type { Loan } from "@/types/FinanceTypes";
import { LoanStatus } from "@/types/FinanceTypes";

export type LoanTotals = {
  totalLoans: number;
  activeLoans: number;
  closedLoans: number;
  /** Integer paise, including the amounts advanced on imported loans. */
  totalPrincipal: number;
  /** Integer paise, read at the current month. */
  totalEmi: number;
  importedLoans: number;
  /** Loans whose calculation could not be read, and which therefore contribute nothing. */
  unresolved: number;
  /** True while the list, or any imported loan's calculation, is still being read. */
  isLoading: boolean;
  error: string | null;
};

const EMPTY: LoanTotals = {
  totalLoans: 0,
  activeLoans: 0,
  closedLoans: 0,
  totalPrincipal: 0,
  totalEmi: 0,
  importedLoans: 0,
  unresolved: 0,
  isLoading: true,
  error: null,
};

/**
 * Totals computed in the browser, across every loan the user holds.
 *
 * The API's own summary aggregates *stored* values, and an imported loan stores none — its
 * principal and EMI live on the calculation. A total taken from the server would quietly
 * omit every imported loan, so these are summed from the loans themselves with each import
 * resolved first.
 *
 * Capped at {@link MAX_PAGE_LIMIT} loans, the same ceiling the API enforces. A user with more
 * loans than that gets a total over the first hundred; the count beside it says how many
 * loans there are, so a shortfall is visible rather than inferred.
 */
export const useLoanTotals = (reloadToken = 0): LoanTotals => {
    const { authorisedRequest } = useAuth();
    const [loans, setLoans] = useState<Loan[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setIsLoadingList(true);
            setError(null);

            try {
                const { items } = await listLoans(authorisedRequest, {
                    limit: MAX_PAGE_LIMIT,
                });

                if (!cancelled) {
                    setLoans(items);
                }
            } catch (thrown) {
                if (!cancelled) {
                    setLoans([]);
                    setError(
                        thrown instanceof Error
                            ? thrown.message
                            : "We could not read your loans."
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

    const { figuresFor, isResolving, unresolved } = useImportedLoanFigures(
        loans,
        reloadToken
    );

    const totals = useMemo<LoanTotals>(() => {
        if (isLoadingList) {
            return EMPTY;
        }

        let totalPrincipal = 0;
        let totalEmi = 0;
        let activeLoans = 0;
        let closedLoans = 0;
        let importedLoans = 0;

        for (const loan of loans) {
            if (loan.status === LoanStatus.ACTIVE) {
                activeLoans += 1;
            }
            if (loan.status === LoanStatus.CLOSED) {
                closedLoans += 1;
            }
            if (isImportedLoan(loan)) {
                importedLoans += 1;
            }

            const figures = figuresFor(loan);
            totalPrincipal += figures.principal ?? 0;
            totalEmi += figures.emiAmount ?? 0;
        }

        return {
            totalLoans: loans.length,
            activeLoans,
            closedLoans,
            totalPrincipal,
            totalEmi,
            importedLoans,
            unresolved,
            isLoading: isResolving,
            error,
        };
    }, [error, figuresFor, isLoadingList, isResolving, loans, unresolved]);

    return totals;
};
