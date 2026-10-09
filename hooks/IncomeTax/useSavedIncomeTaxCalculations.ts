"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { getAuthErrorCopy } from "@/helpers/apiErrors";
import { listIncomeTaxCalculations } from "@/services/incomeTax/calculations";
import type { SavedIncomeTaxCalculation } from "@/types/IncomeTax/CalculationTypes";

export type SavedIncomeTaxCalculationsState = {
  calculations: SavedIncomeTaxCalculation[];
  isLoading: boolean;
  error: string | null;
  /** Re-reads the list, so a scenario saved a moment ago appears in the dropdown at once. */
  refetch: () => void;
  /**
   * A scenario the dropdown has picked, waiting to be applied to the calculator.
   *
   * A value rather than a callback, because the dropdown and the calculator are siblings in the
   * page tree and so cannot hand each other a function. The calculator reads this, applies it,
   * and clears it.
   */
  pendingCalculation: SavedIncomeTaxCalculation | null;
  applyCalculation: (calculation: SavedIncomeTaxCalculation) => void;
  /** Called by the calculator once the scenario has been applied. */
  clearPendingCalculation: () => void;
};

/**
 * One read of the caller's saved income-tax scenarios, shared by the dropdown and the save flow.
 *
 * An anonymous visitor makes no request at all: the list is behind a session, so asking for it
 * would only produce a guaranteed `401`. The whole feature is therefore invisible until the user
 * signs in, rather than offering buttons that cannot work.
 */
export const useSavedIncomeTaxCalculations = (): SavedIncomeTaxCalculationsState => {
  const { isSignedIn, authorisedRequest } = useAuth();
  const [calculations, setCalculations] = useState<SavedIncomeTaxCalculation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [pendingCalculation, setPendingCalculation] =
    useState<SavedIncomeTaxCalculation | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      // Reuses the existing array when it is already empty, so signing out does not queue a
      // render that changes nothing.
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
        const { items } = await listIncomeTaxCalculations(authorisedRequest);

        if (!cancelled) {
          setCalculations(items);
        }
      } catch (thrown) {
        if (cancelled) {
          return;
        }

        // An empty list and a failed read look identical to a user, so the difference is kept in
        // `error` rather than swallowed.
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

  const applyCalculation = useCallback((calculation: SavedIncomeTaxCalculation) => {
    setPendingCalculation(calculation);
  }, []);

  const clearPendingCalculation = useCallback(() => {
    setPendingCalculation(null);
  }, []);

  // Signing out drops the list, so a pending apply would target a scenario the calculator could no
  // longer name back to the user.
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