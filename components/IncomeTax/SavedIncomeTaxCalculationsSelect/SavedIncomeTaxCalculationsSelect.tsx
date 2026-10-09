"use client";

import { useCallback, useEffect, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material";
import { useAuth } from "@/contexts/authContext";
import { useSavedIncomeTaxCalculationsProvider } from "@/contexts/incomeTax/savedCalculationsContext";
import { formatPaise } from "@/helpers/money";
import { toDisplayRegime } from "@/types/IncomeTax/CalculationTypes";

import styles from "./SavedIncomeTaxCalculationsSelect.module.css";

/** No saved scenarios yet. */
const EMPTY_MESSAGE = "No saved income tax calculations yet";
const LOADING_MESSAGE = "Loading saved calculations";
const ERROR_MESSAGE = "Could not load saved calculations";

/**
 * Picks up an income-tax scenario the user saved earlier.
 *
 * Sits above the calculator's own inputs, so a scenario can be picked before anything is typed
 * rather than only once there are figures to overwrite.
 *
 * Signed out there is nothing to pick from, so the control is not rendered at all — an empty
 * dropdown on a page that offers no way to fill it is just clutter, and the whole feature is
 * behind a session.
 */
const SavedIncomeTaxCalculationsSelect = () => {
  const { isSignedIn } = useAuth();
  // From the provider rather than the hook directly: this and the calculator must be looking at
  // the same read, or the scenario picked here is set on a copy the calculator never sees.
  const { calculations, isLoading, error, applyCalculation } =
    useSavedIncomeTaxCalculationsProvider();
  const [selectedId, setSelectedId] = useState("");

  // Signing out empties the list, so a selection pointing into it would be left addressing
  // nothing. Cleared here rather than on sign-in, so signing back in starts from the list rather
  // than from a stale choice.
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
        : "Select a saved calculation";

  return (
    <div className={styles.container} data-testid="saved-income-tax-calculations">
      <label className={styles.label} htmlFor="saved-income-tax-calculation">
        Saved Calculations
      </label>
      <Select
        id="saved-income-tax-calculation"
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
        {/*
          * The year and regime on each row, not just the name: two scenarios saved a year apart
          * are the same name far more often than not, and picking the wrong one silently quotes
          * last year's slabs.
         */}
        {calculations.map((calculation) => (
          <MenuItem key={calculation.id} value={calculation.id}>
            {`${calculation.name} — ${calculation.financialYear} · ${toDisplayRegime(
              calculation.regime
            )} · ${formatPaise(calculation.annualIncome)}`}
          </MenuItem>
        ))}
      </Select>
    </div>
  );
};

export default SavedIncomeTaxCalculationsSelect;