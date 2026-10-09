"use client";

import { useCallback, useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import type { AdditionalIncomeEntry } from "@/types/IncomeTax/CalculationTypes";
import { PAISE_PER_RUPEE } from "@/helpers/money";

import styles from "./AdditionalIncomeDialog.module.css";

export type Props = {
  open: boolean;
  /**
   * The line being edited, or `null` to add a new one.
   *
   * One dialog for both, for the reason every other form in this app is: a line being corrected
   * is the same two facts as a line being created, and a second form would be a second place to
   * get the validation wrong.
   */
  entry: AdditionalIncomeEntry | null;
  /** Called with the entry. Nothing is sent anywhere — the line is held by the caller. */
  onClose: () => void;
  onSave: (entry: AdditionalIncomeEntry) => void;
};

/** Rupees, whole. A paise-amounted line the user typed as a fraction would be noise here. */
const isWholeRupees = (typed: string): boolean => /^\d+$/.test(typed.trim());

/**
 * One line of side income, added or corrected.
 *
 * Deliberately just a source and an amount. A side income is not a holding and not a record with
 * its own life — it is a number added to a year — so anything more here would be asking for
 * facts this form has nowhere to put.
 */
const AdditionalIncomeDialog = ({ open, entry, onClose, onSave }: Props) => {
  const isEditing = entry !== null;
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  /**
   * Seeded from the line being edited, and blank for a new one.
   *
   * Keyed on the entry as well as on `open`, because the dialog is reopened for each edit: two
   * edits in a row would otherwise open showing the line before last.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    setSource(entry?.source ?? "");
    // Paise back to whole rupees, which is what the box holds.
    setAmount(entry === null ? "" : String(entry.amount / PAISE_PER_RUPEE));
    setSourceError(null);
    setAmountError(null);
  }, [entry, open]);

  const handleSave = useCallback(() => {
    const trimmedSource = source.trim();
    const trimmedAmount = amount.trim();
    const nextSourceError = trimmedSource ? null : "Say what this income was.";
    const nextAmountError = !trimmedAmount
      ? "Enter an amount."
      : !isWholeRupees(trimmedAmount)
        ? "Enter a whole number of rupees."
        : null;

    setSourceError(nextSourceError);
    setAmountError(nextAmountError);

    if (nextSourceError || nextAmountError) {
      return;
    }

    // Whole rupees in, paise out — the one conversion, done here so every consumer of the list
    // works in the same unit as the rest of the app.
    onSave({ source: trimmedSource, amount: Number(trimmedAmount) * 100 });
  }, [amount, onSave, source]);

  const resolvedSourceError = sourceError;
  const resolvedAmountError = amountError;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      data-testid="additional-income-dialog"
    >
      <DialogTitle>
        {isEditing ? "Edit Additional Income" : "Add Additional Income"}
      </DialogTitle>

      <DialogContent>
        <div className={styles.field}>
          <TextField
            size="small"
            fullWidth
            required
            label="Source"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setSourceError((current) => (current ? null : current));
            }}
            error={!!resolvedSourceError}
            helperText={resolvedSourceError ?? " "}
            autoFocus
            slotProps={{
              htmlInput: {
                maxLength: 120,
                "data-testid": "additional-income-source",
              },
            }}
          />
        </div>

        <div className={styles.field}>
          <TextField
            size="small"
            fullWidth
            required
            label="Annual amount"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setAmountError((current) => (current ? null : current));
            }}
            error={!!resolvedAmountError}
            helperText={resolvedAmountError ?? " "}
            slotProps={{
              htmlInput: {
                inputMode: "numeric",
                "data-testid": "additional-income-amount",
              },
            }}
          />
        </div>
      </DialogContent>

      <DialogActions className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onClose}
          data-testid="additional-income-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleSave}
          data-testid="additional-income-save"
        >
          {isEditing ? "Save changes" : "Save"}
        </button>
      </DialogActions>
    </Dialog>
  );
};

export default AdditionalIncomeDialog;