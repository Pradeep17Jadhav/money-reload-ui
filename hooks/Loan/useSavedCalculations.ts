"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { getAuthErrorCopy } from "@/helpers/apiErrors";
import { listCalculations } from "@/services/loan/calculations";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";

export type SavedCalculationsState = {
    calculations: SavedLoanCalculation[];
    isLoading: boolean;
    error: string | null;
    /** Re-reads the list. Called after a save so a new scenario appears at once. */
    refetch: () => void;
    /**
     * A scenario the dropdown has picked, waiting to be applied to the calculator.
     *
     * A value rather than a callback because the dropdown and the calculator are
     * siblings in the page tree, so the dropdown cannot hand the calculator a
     * function. Lifting the calculator's own state up here to make that possible would
     * put the whole schedule in a context for the sake of one event. The calculator
     * reads this, applies it, and clears it.
     */
    pendingCalculation: SavedLoanCalculation | null;
    applyCalculation: (calculation: SavedLoanCalculation) => void;
    /** Called by the calculator once the scenario has been applied. */
    clearPendingCalculation: () => void;
};

/**
 * One read of the caller's saved calculations, shared by everything that shows
 * them.
 *
 * An anonymous visitor makes no request at all: the list is behind a session, so
 * asking for it would only produce a guaranteed `401`.
 */
export const useSavedCalculations = (): SavedCalculationsState => {
    const { isSignedIn, authorisedRequest } = useAuth();
    const [calculations, setCalculations] = useState<SavedLoanCalculation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [pendingCalculation, setPendingCalculation] =
        useState<SavedLoanCalculation | null>(null);

    useEffect(() => {
        if (!isSignedIn) {
            // Reuses the existing array when it is already empty, so signing out
            // does not queue a render that changes nothing.
            setCalculations((current) => (current.length === 0 ? current : []));
            setError(null);
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        const run = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const { items } = await listCalculations(authorisedRequest);

                if (!cancelled) {
                    setCalculations(items);
                }
            } catch (thrown) {
                if (cancelled) {
                    return;
                }

                // An empty list and a failed read look identical to a user, so
                // the difference is kept in `error` rather than swallowed.
                setCalculations([]);
                setError(getAuthErrorCopy(thrown).banner);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [authorisedRequest, isSignedIn, reloadToken]);

    const refetch = useCallback(() => {
        setReloadToken((token) => token + 1);
    }, []);

    const applyCalculation = useCallback((calculation: SavedLoanCalculation) => {
        setPendingCalculation(calculation);
    }, []);

    const clearPendingCalculation = useCallback(() => {
        setPendingCalculation(null);
    }, []);

    // Signing out drops the list, so a pending apply would target a scenario the
    // calculator could no longer name back to the user.
    useEffect(() => {
        if (!isSignedIn) {
            setPendingCalculation(null);
        }
    }, [isSignedIn]);

    return useMemo(
        () => ({
            calculations,
            isLoading,
            error,
            refetch,
            pendingCalculation,
            applyCalculation,
            clearPendingCalculation,
        }),
        [
            applyCalculation,
            calculations,
            clearPendingCalculation,
            error,
            isLoading,
            pendingCalculation,
            refetch,
        ]
    );
};