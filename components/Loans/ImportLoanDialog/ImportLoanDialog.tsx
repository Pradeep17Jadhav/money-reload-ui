"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { useAuth } from "@/contexts/authContext";
import { getAuthErrorCopy } from "@/helpers/apiErrors";
import { formatPercent } from "@/helpers/money";
import { getCalculationsByIds, listCalculations } from "@/services/loan/calculations";
import { createLoan, listLoans, updateLoan } from "@/services/finance/records";
import { MAX_PAGE_LIMIT } from "@/constants/records";
import { projectLoanCalculation } from "@/components/Loans/helpers/loanProjection";
import type { LoanProjection } from "@/components/Loans/helpers/loanProjection";
import {
  LOAN_STATUS_OPTIONS,
  LOAN_TYPE_OPTIONS,
} from "@/constants/records";
import { InterestType, LoanStatus, LoanType } from "@/types/FinanceTypes";
import type { Loan } from "@/types/FinanceTypes";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";

import styles from "./ImportLoanDialog.module.css";

/**
 * The facts the user supplies; everything else comes from the calculation.
 *
 * Deliberately short. A loan imported from a scenario is, by definition, that scenario plus
 * the handful of things a calculator never knew — who the lender is and what the loan is for.
 */
type TypedField =
  | "title"
  | "lender"
  | "loanType"
  | "status"
  | "purpose"
  | "reference"
  | "notes"
  | "undisbursedAmount";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called once the loan is saved, so the list can re-read it. */
  onSaved: () => void;
  /**
   * The imported loan being edited, or `null` to import a new one.
   *
   * The same dialog for both, deliberately. An imported loan stores no principal, rate, end
   * date or EMI — they are read from its calculation — so the generic edit form would show a
   * row of empty boxes for the very fields that matter, and would offer to set the ones the
   * API refuses on a linked loan. Editing here instead keeps one form and one rule: the
   * calculation's figures are shown, and only the user's own fields are asked for.
   */
  loan: Loan | null;
};

const DEFAULT_VALUES: Record<TypedField, string> = {
  title: "",
  lender: "",
  loanType: LoanType.HOME,
  status: LoanStatus.ACTIVE,
  purpose: "",
  reference: "",
  notes: "",
  undisbursedAmount: "",
};

/**
 * Rupees typed into a money box, as paise.
 *
 * The same conversion the generic record form applies, inlined because this dialog builds its
 * own payload rather than going through `buildPayload`. A blank box means "not stated" and
 * yields `undefined`, so the key is left out of the request entirely — the API stores `null`,
 * which reads as nobody having said, rather than as zero left to receive.
 */
const rupeesToPaise = (typed: string): number | undefined => {
  const trimmed = typed.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const rupees = Number(trimmed);

  if (!Number.isFinite(rupees) || rupees < 0) {
    return undefined;
  }

  return Math.round(rupees * 100);
};

/**
 * The loan type a calculation implies, so the dropdown is not blank on open.
 *
 * The saved scenario recorded which calculator it came from, and that is a better default
 * than asking the user to restate it.
 */
const LOAN_TYPE_BY_CALCULATION_TYPE: Record<string, LoanType> = {
  HOME: LoanType.HOME,
  CAR: LoanType.VEHICLE,
  PERSONAL: LoanType.PERSONAL,
};

/**
 * The scenarios a loan has already been imported from.
 *
 * An imported loan keeps no figures of its own — every one is read back from its calculation —
 * so a second loan off the same scenario is not a second loan. It is the same numbers under a
 * second title, and the user is left maintaining two rows that can never disagree and never
 * need to. Withholding the scenario is therefore the whole point of offering a choice at all.
 *
 * Read from the loans rather than remembered, so it stays right however the list got here: a
 * loan imported on another page, or one deleted since, is accounted for without the dialog
 * keeping any state of its own.
 *
 * Soft-deleted loans are not counted, and that is deliberate rather than incidental: they are
 * not in the default list, and a loan the user threw away should not go on blocking the
 * scenario it came from.
 *
 * Bounded to one page of loans, like every other "which loans exist" read in this app. Beyond
 * `MAX_PAGE_LIMIT` loans an already-imported scenario could slip back into the list — and the
 * API accepts the duplicate, so this is a courtesy rather than a guarantee.
 */
const takenCalculationIds = (loans: Loan[]): Set<string> =>
  new Set(
    loans
      .map((loan) => loan.loanCalculationId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );

const ImportLoanDialog = ({ open, onClose, onSaved, loan }: Props) => {
  const { authorisedRequest } = useAuth();
  const isEditing = loan !== null;

  const [calculations, setCalculations] = useState<SavedLoanCalculation[]>([]);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [values, setValues] = useState<Record<TypedField, string>>(DEFAULT_VALUES);
  const [errors, setErrors] = useState<Partial<Record<TypedField, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Reopened, or opened on a different loan, so it must not carry the last one's answers.
   *
   * Editing starts from the loan's own stored fields. Only those are restored — the derived
   * ones are null on an imported loan, and restoring null into a field this dialog does not
   * show would be noise.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedId(loan?.loanCalculationId ?? "");
    setValues(
      loan
        ? {
            title: loan.title,
            lender: loan.lender,
            loanType: loan.loanType,
            status: loan.status,
            purpose: loan.purpose ?? "",
            reference: loan.reference ?? "",
            notes: loan.notes ?? "",
            // Rupees, because that is what the box holds.
            undisbursedAmount:
              loan.undisbursedAmount === null
                ? ""
                : String(loan.undisbursedAmount / 100),
          }
        : DEFAULT_VALUES
    );
    setErrors({});
    setBanner(null);
  }, [loan, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoadingList(true);
      setListError(null);

      try {
        /*
         * Editing needs exactly one calculation, and importing needs all of them. Asking for
         * the whole list to edit one loan would be wasteful, and would put every scenario the
         * user has into a dropdown they are not choosing from.
         *
         * Importing additionally needs the loans already standing, so the scenarios they were
         * imported from can be held back. The two go together because a half-known list is
         * worse than none: failing either read leaves the dropdown closed rather than offering
         * a scenario that may already be spoken for.
         *
         * Editing needs no loans read at all — its scenario is attached already and is never
         * offered for swapping.
         */
        if (isEditing) {
          const result = Object.values(
            await getCalculationsByIds(authorisedRequest, [
              loan?.loanCalculationId ?? "",
            ])
          );

          if (cancelled) {
            return;
          }

          setCalculations(result);
          setImportedIds(new Set());

          return;
        }

        const [calculationList, loanList] = await Promise.all([
          listCalculations(authorisedRequest),
          listLoans(authorisedRequest, { limit: MAX_PAGE_LIMIT }),
        ]);

        if (cancelled) {
          return;
        }

        setCalculations(calculationList.items);
        setImportedIds(takenCalculationIds(loanList.items));
      } catch (thrown) {
        if (!cancelled) {
          setListError(getAuthErrorCopy(thrown).banner);
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
  }, [authorisedRequest, isEditing, loan?.loanCalculationId, open]);

  /**
   * What the dropdown may offer: every saved scenario except the ones already spoken for.
   *
   * Filtered rather than disabled, so an imported scenario is not something to click past —
   * and the empty state below can say *why* the list is short.
   */
  const available = useMemo(
    () => calculations.filter((entry) => !importedIds.has(entry.id)),
    [calculations, importedIds]
  );

  const selected = useMemo(
    () =>
      isEditing
        ? calculations[0] ?? null
        : available.find((entry) => entry.id === selectedId) ?? null,
    [available, calculations, isEditing, selectedId]
  );

  const projection = useMemo(
    () => (selected ? projectLoanCalculation(selected) : null),
    [selected]
  );

  const handleSelect = useCallback(
    (event: SelectChangeEvent<string>) => {
      const id = event.target.value;
      setSelectedId(id);

      const calculation = available.find((entry) => entry.id === id);

      // Prefills only the one field the calculation can actually answer. Leaving the rest
      // alone matters: the user's own wording is not ours to overwrite.
      if (calculation) {
        setValues((current) => ({
          ...current,
          loanType:
            LOAN_TYPE_BY_CALCULATION_TYPE[calculation.calculationType] ??
            current.loanType,
        }));
      }
    },
    [available]
  );

  const handleChange = useCallback((field: TypedField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const { [field]: _cleared, ...rest } = current;
      return rest;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const lender = values.lender.trim();
    const title = values.title.trim();

    const nextErrors: Partial<Record<TypedField, string>> = {};

    if (!title) {
      nextErrors.title = "Give this loan a name.";
    }
    if (!lender) {
      nextErrors.lender = "A lender is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    // Editing does not need the calculation: everything that depends on it is already stored
    // on the loan, and the figures this dialog shows are only there to be looked at.
    if (!isEditing && (!selected || !projection)) {
      setBanner("Pick a saved calculation to import.");
      return;
    }

    setIsSaving(true);
    setBanner(null);

    try {
      const undisbursedAmount = rupeesToPaise(values.undisbursedAmount);

      /*
       * The same field list in both modes, and in both it is only what the user owns.
       *
       * On create: plus the calculation reference and the scenario's own start month, which
       * is structural — the API indexes and date-filters every loan by it. Read from the
       * calculation rather than typed, so the two cannot disagree.
       *
       * On edit: nothing else. `loanCalculationId`, `startDate` and `interestType` are simply
       * absent, and PATCH is partial, so they stay as they are. And the derived figures stay
       * absent too, which is not an oversight: the API refuses them on a linked loan, and
       * they are read back from the calculation regardless.
       *
       * The optional strings are sent as explicit `null` when blank, so clearing one actually
       * clears it rather than leaving the old value untouched.
       */
      const fields = {
        title,
        lender,
        loanType: values.loanType,
        status: values.status,
        purpose: values.purpose.trim() || null,
        reference: values.reference.trim() || null,
        notes: values.notes.trim() || null,
        // Null rather than omitted: blank means "nothing left to receive", which is a real
        // answer, and the API stores `null` for exactly that.
        undisbursedAmount: undisbursedAmount ?? null,
      };

      if (isEditing && loan) {
        await updateLoan(authorisedRequest, loan.id, fields);
      } else {
        await createLoan(authorisedRequest, {
          ...fields,
          interestType: InterestType.REDUCING_BALANCE,
          startDate: (projection as LoanProjection).startMonth.format("YYYY-MM-01"),
          loanCalculationId: (selected as SavedLoanCalculation).id,
        });
      }

      onClose();
      onSaved();
    } catch (thrown) {
      const copy = getAuthErrorCopy(thrown);
      setBanner(copy.banner);
      setErrors(copy.fields as Partial<Record<TypedField, string>>);
    } finally {
      setIsSaving(false);
    }
  }, [authorisedRequest, isEditing, loan, onClose, onSaved, projection, selected, values]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      data-testid="import-loan-dialog"
    >
      <DialogTitle>
        {isEditing ? "Edit imported loan" : "Import loan from a saved calculation"}
      </DialogTitle>

      <DialogContent>
        {banner && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="import-loan-banner">
            {banner}
          </Alert>
        )}

        {/*
          * The calculation dropdown only exists when importing. On an edit the scenario is
          * already attached, and swapping it for a different one is a different operation —
          * it would silently re-point every figure on the loan, which is not something to do
          * by accident while renaming it.
          */}
        {!isEditing && (
          <div className={styles.field}>
            <FormControl fullWidth size="small" error={!!listError}>
              <InputLabel id="import-calculation-label">Saved calculation</InputLabel>
              <Select
                labelId="import-calculation-label"
                id="import-calculation"
                label="Saved calculation"
                value={selectedId}
                onChange={handleSelect}
                disabled={isLoadingList || available.length === 0}
                inputProps={{ "data-testid": "import-calculation-select" }}
              >
                {available.map((calculation) => (
                  <MenuItem key={calculation.id} value={calculation.id}>
                    {calculation.name}
                  </MenuItem>
                ))}
              </Select>
              {listError && (
                <p className={styles.error} role="alert">
                  {listError}
                </p>
              )}
              {!isLoadingList && !listError && available.length === 0 && (
                <p className={styles.helper}>
                  {calculations.length > 0
                    ? "Every saved calculation has already been imported as a loan."
                    : "No saved calculations yet. Save one from a loan calculator first."}
                </p>
              )}
            </FormControl>
          </div>
        )}

        {isLoadingList && (
          <p className={styles.helper} role="status">
            <CircularProgress size={14} /> Loading saved calculations
          </p>
        )}

        {projection && (
          <div className={styles.derived} data-testid="import-derived">
            <p className={styles.derivedTitle}>
              From the calculation, at {projection.activeMonth.format("MMMM YYYY")}
            </p>
            <dl className={styles.derivedGrid}>
              <div>
                <dt>Amount disbursed</dt>
                <dd>{(projection.principal / 100).toLocaleString("en-IN")}</dd>
              </div>
              <div>
                <dt>Rate of interest</dt>
                {/*
                 * Through `formatPercent`, not interpolated raw. The raw form read `8%` or
                 * `8.5%`, so this panel and the loan's own Rate column quoted the same figure at
                 * two different precisions.
                 */}
                <dd>{formatPercent(projection.interestRate)}</dd>
              </div>
              <div>
                <dt>EMI</dt>
                <dd>{Math.round(projection.emi / 100).toLocaleString("en-IN")}</dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>{projection.endMonth.format("MMM YYYY")}</dd>
              </div>
              <div>
                <dt>Tenure</dt>
                <dd>
                  {Math.floor(projection.tenureMonths / 12)}y{" "}
                  {projection.tenureMonths % 12}m
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/*
          * The calculation behind an edited loan could not be read — deleted, or belonging to
          * somebody else. Said plainly rather than left as an absent panel, because the loan
          * still works: its own fields are editable and saving them does not touch the link.
          */}
        {isEditing && !isLoadingList && !listError && !projection && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="import-calculation-missing">
            The saved calculation behind this loan could not be read, so its figures are not
            shown. You can still edit the details below.
          </Alert>
        )}

        <div className={styles.grid}>
          <TextField
            size="small"
            fullWidth
            label="Title"
            required
            value={values.title}
            onChange={(event) => handleChange("title", event.target.value)}
            error={!!errors.title}
            helperText={errors.title ?? " "}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "import-title" } }}
          />

          <TextField
            size="small"
            fullWidth
            label="Lender"
            required
            value={values.lender}
            onChange={(event) => handleChange("lender", event.target.value)}
            error={!!errors.lender}
            helperText={errors.lender ?? " "}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "import-lender" } }}
          />

          <TextField
            size="small"
            fullWidth
            select
            label="Loan type"
            value={values.loanType}
            onChange={(event) => handleChange("loanType", event.target.value)}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "import-loan-type" } }}
          >
            {LOAN_TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            fullWidth
            select
            label="Status"
            value={values.status}
            onChange={(event) => handleChange("status", event.target.value)}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "import-status" } }}
          >
            {LOAN_STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            fullWidth
            label="Undisbursed amount"
            value={values.undisbursedAmount}
            onChange={(event) =>
              handleChange("undisbursedAmount", event.target.value)
            }
            disabled={isSaving}
            slotProps={{
              htmlInput: {
                "data-testid": "import-undisbursed",
                inputMode: "decimal",
              },
            }}
          />

          <TextField
            size="small"
            fullWidth
            label="Reference"
            value={values.reference}
            onChange={(event) => handleChange("reference", event.target.value)}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "import-reference" } }}
          />
        </div>

        <TextField
          size="small"
          fullWidth
          label="Purpose"
          value={values.purpose}
          onChange={(event) => handleChange("purpose", event.target.value)}
          disabled={isSaving}
          sx={{ mt: 2 }}
          slotProps={{ htmlInput: { "data-testid": "import-purpose" } }}
        />

        <TextField
          size="small"
          fullWidth
          multiline
          minRows={2}
          label="Notes"
          value={values.notes}
          onChange={(event) => handleChange("notes", event.target.value)}
          disabled={isSaving}
          sx={{ mt: 2 }}
          slotProps={{ htmlInput: { "data-testid": "import-notes" } }}
        />
      </DialogContent>

      <DialogActions className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onClose}
          disabled={isSaving}
          data-testid="import-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            void handleSave();
          }}
          /*
           * Gated on the calculation only when importing. Editing must not depend on it:
           * a loan whose scenario has been deleted still has editable fields of its own, and
           * refusing to save them would make a broken link permanent.
           */
          disabled={isSaving || (!isEditing && !selected)}
          data-testid="import-save"
        >
          {isSaving && <CircularProgress size={16} thickness={5} aria-label="Saving" />}
          {isEditing ? "Save changes" : "Import loan"}
        </button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportLoanDialog;
