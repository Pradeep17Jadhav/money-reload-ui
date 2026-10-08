"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useSavedCalculations } from "@/hooks/Loan/useSavedCalculations";
import type { SavedCalculationsState } from "@/hooks/Loan/useSavedCalculations";

const SavedCalculationsContext = createContext<SavedCalculationsState | null>(null);

/**
 * The saved-calculation dropdown sits above the calculator in the page and the
 * save dialog sits deep inside its input column, so the two ends share a single
 * read of the list: a save refreshes the same list the dropdown is already
 * rendering, instead of the dropdown learning about it second-hand.
 */
export const SavedCalculationsProvider = ({ children }: { children: ReactNode }) => {
    const savedCalculations = useSavedCalculations();

    return (
        <SavedCalculationsContext.Provider value={savedCalculations}>
            {children}
        </SavedCalculationsContext.Provider>
    );
};

export const useSavedCalculationsProvider = (): SavedCalculationsState => {
    const context = useContext(SavedCalculationsContext);

    if (!context) {
        throw new Error(
            "useSavedCalculationsProvider must be used within a SavedCalculationsProvider"
        );
    }

    return context;
};