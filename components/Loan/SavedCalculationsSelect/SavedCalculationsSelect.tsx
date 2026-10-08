"use client";

import { useCallback, useEffect, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material";
import { useAuth } from "@/contexts/authContext";
import { useSavedCalculationsProvider } from "@/contexts/loan/savedCalculationsContext";

import styles from "./SavedCalculationsSelect.module.css";

/** No saved calculations yet. */
const EMPTY_MESSAGE = "No saved calculations yet";
const LOADING_MESSAGE = "Loading saved calculations";
const ERROR_MESSAGE = "Could not load saved calculations";

/**
 * Picks up a scenario the user saved earlier.
 *
 * Signed out there is nothing to pick from, so the control is not rendered at
 * all rather than shown empty — an empty dropdown on a page that offers no way
 * to fill it is just clutter.
 */
const SavedCalculationsSelect = () => {
    const { isSignedIn } = useAuth();
    const { calculations, isLoading, error, applyCalculation } =
        useSavedCalculationsProvider();
    const [selectedId, setSelectedId] = useState("");

    // Signing out empties the list, so a selection pointing into it would be
    // left addressing nothing. Cleared here rather than on sign-in, so signing
    // back in starts from the list rather than from a stale choice.
    useEffect(() => {
        if (!isSignedIn) {
            setSelectedId("");
        }
    }, [isSignedIn]);

    const handleChange = useCallback(
        (event: SelectChangeEvent<string>) => {
            const id = event.target.value;
            setSelectedId(id);

            const calculation = calculations.find((entry) => entry.id === id);

            if (calculation) {
                applyCalculation(calculation);
            }
        },
        [applyCalculation, calculations]
    );

    if (!isSignedIn) {
        return null;
    }

    const placeholder = isLoading
        ? LOADING_MESSAGE
        : error
        ? ERROR_MESSAGE
        : calculations.length === 0
        ? EMPTY_MESSAGE
        : "Select a calculation";

    return (
        <div className={styles.container} data-testid="saved-calculations">
            <label className={styles.label} htmlFor="saved-calculation">
                Saved Calculations
            </label>
            <Select
                id="saved-calculation"
                size="small"
                displayEmpty
                disabled={isLoading || !!error || calculations.length === 0}
                value={selectedId}
                onChange={handleChange}
                inputProps={{ "aria-label": "Saved Calculations" }}
            >
                <MenuItem value="" disabled>
                    <em>{placeholder}</em>
                </MenuItem>
                {calculations.map((calculation) => (
                    <MenuItem key={calculation.id} value={calculation.id}>
                        {calculation.name}
                    </MenuItem>
                ))}
            </Select>
        </div>
    );
};

export default SavedCalculationsSelect;