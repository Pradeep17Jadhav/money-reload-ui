"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useSavedIncomeTaxCalculations } from "@/hooks/IncomeTax/useSavedIncomeTaxCalculations";
import type { SavedIncomeTaxCalculationsState } from "@/hooks/IncomeTax/useSavedIncomeTaxCalculations";

const SavedIncomeTaxCalculationsContext =
  createContext<SavedIncomeTaxCalculationsState | null>(null);

/**
 * The one read of the saved income-tax scenarios, shared by the dropdown and the calculator.
 *
 * **This has to be a provider, not a hook called in both places.** The dropdown sets a scenario
 * for the calculator to apply, and the two are siblings in the tree, so a plain hook would give
 * each its own copy of `pendingCalculation` — the dropdown would set its own, and the calculator
 * would read the other's, which is permanently `null`. The pick would silently do nothing.
 *
 * It is a context rather than lifting the calculator's state here because that would put the whole
 * tax schedule in a shared value for the sake of one event. Only the scenario selection needs to
 * cross; the figures stay where they are.
 */
export const SavedIncomeTaxCalculationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const savedCalculations = useSavedIncomeTaxCalculations();

  return (
    <SavedIncomeTaxCalculationsContext.Provider value={savedCalculations}>
      {children}
    </SavedIncomeTaxCalculationsContext.Provider>
  );
};

export const useSavedIncomeTaxCalculationsProvider =
  (): SavedIncomeTaxCalculationsState => {
    const context = useContext(SavedIncomeTaxCalculationsContext);

    if (!context) {
      throw new Error(
        "useSavedIncomeTaxCalculationsProvider must be used within a SavedIncomeTaxCalculationsProvider"
      );
    }

    return context;
  };