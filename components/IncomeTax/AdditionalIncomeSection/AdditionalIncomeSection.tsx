"use client";

import { useCallback, useState } from "react";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Section from "@/components/Section/Section";
import LargeButton from "@/components/Buttons/LargeButton/LargeButton";
import { formatPaise } from "@/helpers/money";
import type { AdditionalIncomeEntry } from "@/types/IncomeTax/CalculationTypes";
import AdditionalIncomeDialog from "./AdditionalIncomeDialog";

import styles from "./AdditionalIncomeSection.module.css";

type Props = {
  /** The lines held by the page. Integer paise, like every other amount here. */
  entries: AdditionalIncomeEntry[];
  /** Adds a line, or replaces the one at `index` when an edit is being saved. */
  onChange: (entry: AdditionalIncomeEntry, index: number | null) => void;
  /** Removes the line at this index. */
  onRemove: (index: number) => void;
};

/**
 * The side incomes taxed on top of the main one.
 *
 * Sits below the calculator rather than in it because these are not inputs to the tax
 * *formula* — they are facts about the taxpayer, added afterwards, and the calculator is told the
 * total rather than owning the list. That is what lets a whole scenario (main income and these
 * lines together) be saved and restored as one thing.
 *
 * A removable, editable line rather than a single extra field: a taxpayer can have several kinds
 * of side income, and collapsing them into one "other income" box would hide which is which — and
 * make correcting one of them impossible without deleting the lot.
 */
const AdditionalIncomeSection = ({ entries, onChange, onRemove }: Props) => {
  /**
   * Which line is being corrected, or `null` when adding.
   *
   * The **index**, not the entry: two lines can legitimately carry the same source and the same
   * amount, so identifying the row by its contents would edit whichever happened to match first.
   */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);

  const openAdd = useCallback(() => {
    setEditingIndex(null);
    setIsDialogOpen(true);
  }, []);

  const openEdit = useCallback(
    (index: number) => {
      setEditingIndex(index);
      setIsDialogOpen(true);
    },
    []
  );

  const handleSave = useCallback(
    (entry: AdditionalIncomeEntry) => {
      onChange(entry, editingIndex);
      setIsDialogOpen(false);
      // Cleared on the way out, so a later "add" cannot land on the row just edited.
      setEditingIndex(null);
    },
    [editingIndex, onChange]
  );

  const handleClose = useCallback(() => {
    setIsDialogOpen(false);
    setEditingIndex(null);
  }, []);

  return (
    <div className={styles.section} data-testid="additional-income-section">
      <Section title="Additional Income">
        <div className={styles.header}>
          <p className={styles.empty}>
            {entries.length === 0
              ? "Anything earned on top of your salary — rent, interest, a side project."
              : "Taxed after your salary, on the slabs it leaves."}
          </p>

          <LargeButton onClick={openAdd} data-testid="add-additional-income">
            Add Income
          </LargeButton>
        </div>

        {entries.length > 0 && (
          <>
            <TableContainer component={Paper} className={styles.tableWrap}>
              <Table size="small" aria-label="Additional income">
                <TableHead>
                  <TableRow>
                    <TableCell>Source</TableCell>
                    <TableCell align="right">Annual amount</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((entry, index) => (
                    <TableRow key={`${entry.source}-${index}`}>
                      <TableCell>{entry.source}</TableCell>
                      <TableCell align="right">{formatPaise(entry.amount)}</TableCell>
                      <TableCell align="right">
                        <button
                          type="button"
                          className={styles.rowButton}
                          aria-label={`Edit ${entry.source}`}
                          onClick={() => openEdit(index)}
                          data-testid={`edit-additional-income-${index}`}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </button>
                        <button
                          type="button"
                          className={styles.rowButton}
                          aria-label={`Remove ${entry.source}`}
                          onClick={() => onRemove(index)}
                          data-testid={`remove-additional-income-${index}`}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <div className={styles.total}>
              <span>Total additional income</span>
              <span data-testid="additional-income-total">
                {formatPaise(total)}
              </span>
            </div>
          </>
        )}
      </Section>

      <AdditionalIncomeDialog
        open={isDialogOpen}
        entry={editingIndex === null ? null : entries[editingIndex] ?? null}
        onClose={handleClose}
        onSave={handleSave}
      />
    </div>
  );
};

export default AdditionalIncomeSection;