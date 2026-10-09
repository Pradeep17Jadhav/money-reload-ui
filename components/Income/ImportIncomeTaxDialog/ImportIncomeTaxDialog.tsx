"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import dayjs from "dayjs";
import { useAuth } from "@/contexts/authContext";
import { getAuthErrorCopy } from "@/helpers/apiErrors";
import { formatPaise } from "@/helpers/money";
import { todayAsDateOnly } from "@/helpers/dates";
import {
  createIncomeTaxCalculation,
  getIncomeTaxCalculationsByIds,
  listIncomeTaxCalculations,
} from "@/services/incomeTax/calculations";
import { createIncome, listIncomes, updateIncome } from "@/services/finance/records";
import { MAX_PAGE_LIMIT } from "@/constants/records";
import { INCOME_CATEGORY_OPTIONS, PAYMENT_MODE_OPTIONS } from "@/constants/records";
import { projectIncomeTaxScenario } from "@/components/IncomeTax/helpers/incomeTaxScenario";
import { toDisplayRegime } from "@/types/IncomeTax/CalculationTypes";
import type { SavedIncomeTaxCalculation } from "@/types/IncomeTax/CalculationTypes";
import {
  IncomeCategory,
  PaymentMode,
  RecurrenceFrequency,
} from "@/types/FinanceTypes";
import type { Budget } from "@/types/ConfigTypes";
import type { Income } from "@/types/FinanceTypes";

import styles from "./ImportIncomeTaxDialog.module.css";

/**
 * The fields this dialog asks for.
 *
 * **`amount` and `taxPaid` are deliberately absent.** Both are the scenario's: its annual income
 * is the figure, and the tax is worked out from that figure against the site's budget config. A
 * box asking for either would be asking the user to retype a number the import is about to supply
 * — and a stored copy would be a second source of truth that could disagree with the scenario
 * the record points at.
 *
 * Everything here is the income's *own* history: who paid it, how it arrived, and when. No
 * calculator can answer any of it.
 */
type TypedField =
  | "source"
  | "date"
  | "category"
  | "paymentMode"
  | "payer"
  | "reference"
  | "notes";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called once the income is saved, so the list can re-read it. */
  onSaved: () => void;
  /**
   * The imported income being edited, or `null` to import a new one.
   *
   * The same dialog for both, for the reason `ImportLoanDialog` is one dialog: an imported
   * income stores no amount and no tax, so the generic edit form would offer to set exactly the
   * two fields the API refuses on a linked record.
   */
  income: Income | null;
  /** The site's income-tax budgets, needed to work a scenario out. */
  budgets: Budget[];
};

const DEFAULT_VALUES: Record<TypedField, string> = {
  source: "",
  date: todayAsDateOnly(),
  category: IncomeCategory.SALARY,
  paymentMode: "",
  payer: "",
  reference: "",
  notes: "",
};

const ImportIncomeTaxDialog = ({ open, onClose, onSaved, income, budgets }: Props) => {
  const { authorisedRequest } = useAuth();
  const isEditing = income !== null;

  const [scenarios, setScenarios] = useState<SavedIncomeTaxCalculation[]>([]);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [values, setValues] = useState<Record<TypedField, string>>(DEFAULT_VALUES);
  const [errors, setErrors] = useState<Partial<Record<TypedField, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Reopened, or opened on a different income, so it must not carry the last one's answers.
   *
   * Editing restores only the income's own fields. `amount` and `taxPaid` are the scenario's, so
   * restoring them here would put a stored copy into a form that has no box for them.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedId(income?.incomeTaxCalculationId ?? "");
    setValues(
      income
        ? {
            source: income.source,
            date: income.date,
            category: income.category,
            paymentMode: income.paymentMode,
            payer: income.payer ?? "",
            reference: income.reference ?? "",
            notes: income.notes ?? "",
          }
        : DEFAULT_VALUES
    );
    setErrors({});
    setBanner(null);
  }, [income, open]);

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
         * Editing needs exactly one scenario, and importing needs all of them — plus the incomes
         * already standing, so the scenarios they were imported from can be held back. The two
         * go together because a half-known list is worse than none: failing either read leaves
         * the dropdown closed rather than offering something already spoken for.
         */
        if (isEditing) {
          const result = Object.values(
            await getIncomeTaxCalculationsByIds(authorisedRequest, [
              income?.incomeTaxCalculationId ?? "",
            ])
          );

          if (cancelled) {
            return;
          }

          setScenarios(result);
          setImportedIds(new Set());
          return;
        }

        const [scenarioList, incomeList] = await Promise.all([
          listIncomeTaxCalculations(authorisedRequest),
          listIncomes(authorisedRequest, { limit: MAX_PAGE_LIMIT }),
        ]);

        if (cancelled) {
          return;
        }

        setScenarios(scenarioList.items);
        setImportedIds(
          new Set(
            incomeList.items
              .filter(
                (item) =>
                  typeof item.incomeTaxCalculationId === "string" &&
                  item.incomeTaxCalculationId.length > 0
              )
              .map((item) => item.incomeTaxCalculationId as string)
          )
        );
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
  }, [authorisedRequest, income?.incomeTaxCalculationId, isEditing, open]);

  /**
   * What the dropdown may offer: every saved scenario except one an income already stands for.
   *
   * A second income off one scenario is not a second income — it is the same annual figure filed
   * twice, and the user is left maintaining two rows that can never disagree and never need to.
   */
  const available = useMemo(
    () => scenarios.filter((entry) => !importedIds.has(entry.id)),
    [importedIds, scenarios]
  );

  const selected = useMemo(
    () =>
      isEditing
        ? scenarios[0] ?? null
        : available.find((entry) => entry.id === selectedId) ?? null,
    [available, isEditing, scenarios, selectedId]
  );

  /**
   * What the scenario works out to, shown rather than asked for.
   *
   * A panel, not disabled inputs: these are not locked against being changed, they simply are not
   * this form's to set. The figures come back from the scenario on every read, so anything typed
   * here would be discarded.
   */
  const derived = useMemo(
    () => (selected ? projectIncomeTaxScenario(selected, budgets) : null),
    [budgets, selected]
  );

  const handleSelect = useCallback(
    (event: SelectChangeEvent<string>) => {
      setSelectedId(event.target.value);
    },
    []
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
    const source = values.source.trim();
    const nextErrors: Partial<Record<TypedField, string>> = {};

    if (!source) {
      nextErrors.source = "Give this income a source.";
    }
    if (!values.date) {
      nextErrors.date = "When was this received?";
    }
    if (!values.paymentMode) {
      nextErrors.paymentMode = "How was this paid?";
    }

    if (!isEditing && (!selected || !derived)) {
      // Saving without a scenario would create a plain income with no amount, which is not a
      // record the API can accept.
      setBanner("Pick a saved calculation to import.");
      return;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    setBanner(null);

    try {
      /*
       * Only the fields the income owns. `amount` and `taxPaid` are absent on purpose — the API
       * refuses them beside `incomeTaxCalculationId`, because the scenario already holds both and
       * a stored copy could never be told from the real one on a later read.
       *
       * The optional strings go as explicit `null` when blank, so clearing one actually clears it
       * rather than leaving the old value untouched.
       */
      const fields = {
        source,
        date: values.date,
        category: values.category as IncomeCategory,
        paymentMode: values.paymentMode as PaymentMode,
        payer: values.payer.trim() || null,
        reference: values.reference.trim() || null,
        notes: values.notes.trim() || null,
      };

      if (isEditing && income) {
        // Not sent at all on an edit: `incomeTaxCalculationId`, `amount` and `taxPaid` are simply
        // absent, and PATCH is partial, so the record keeps pointing at the same scenario.
        await updateIncome(authorisedRequest, income.id, fields);
      } else {
        await createIncome(authorisedRequest, {
          ...fields,
          isRecurring: false,
          recurrenceFrequency: RecurrenceFrequency.MONTHLY,
          incomeTaxCalculationId: (selected as SavedIncomeTaxCalculation).id,
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
  }, [
    authorisedRequest,
    derived,
    income,
    isEditing,
    onClose,
    onSaved,
    selected,
    values,
  ]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      data-testid="import-income-tax-dialog"
    >
      <DialogTitle>
        {isEditing ? "Edit imported income" : "Import income from a saved calculation"}
      </DialogTitle>

      <DialogContent>
        {banner && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="import-income-tax-banner">
            {banner}
          </Alert>
        )}

        {/* The same reasoning as the loan dialog: swapping the scenario would silently re-point
            both the amount and the tax, which is not something to do while renaming a record. */}
        {!isEditing && (
          <div className={styles.field}>
            <FormControl fullWidth size="small" error={!!listError}>
              <InputLabel id="import-income-tax-label">Saved calculation</InputLabel>
              <Select
                labelId="import-income-tax-label"
                id="import-income-tax"
                label="Saved calculation"
                value={selectedId}
                onChange={handleSelect}
                disabled={isLoadingList || available.length === 0}
                inputProps={{ "data-testid": "import-income-tax-select" }}
              >
                {available.map((scenario) => (
                  <MenuItem key={scenario.id} value={scenario.id}>
                    {`${scenario.name} — ${scenario.financialYear} · ${toDisplayRegime(
                      scenario.regime
                    )}`}
                  </MenuItem>
                ))}
              </Select>
              {listError && (
                <p className={styles.error} role="alert">
                  {listError}
                </p>
              )}
              {!isLoadingList && !listError && available.length === 0 && (
                <p className={styles.helper} data-testid="import-income-tax-no-scenarios">
                  {scenarios.length > 0
                    ? "Every saved calculation has already been imported as an income."
                    : "No saved income tax calculations yet. Save one from the income tax calculator first."}
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

        {derived && (
          <div className={styles.derived} data-testid="import-income-tax-derived">
            <p className={styles.derivedTitle}>
              From the calculation, for AY {derived.assessmentYear}
            </p>
            <dl className={styles.derivedGrid}>
              <div>
                <dt>Annual income</dt>
                <dd>{formatPaise(derived.annualIncome)}</dd>
              </div>
              <div>
                <dt>Tax for the year</dt>
                <dd>{formatPaise(derived.tax)}</dd>
              </div>
            </dl>
          </div>
        )}

        {/* Said plainly rather than left as an absent panel: the income still works, its own
            fields are editable, and saving them does not touch the link. */}
        {isEditing && !isLoadingList && !listError && !derived && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="import-income-tax-missing">
            The saved calculation behind this income could not be read, so its figures are not
            shown. You can still edit the details below.
          </Alert>
        )}

        <div className={styles.grid}>
          <TextField
            size="small"
            fullWidth
            required
            label="Source"
            value={values.source}
            onChange={(event) => handleChange("source", event.target.value)}
            error={!!errors.source}
            helperText={errors.source ?? " "}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "import-income-source" } }}
          />

          <TextField
            size="small"
            fullWidth
            required
            type="date"
            label="Date"
            value={values.date}
            onChange={(event) => handleChange("date", event.target.value)}
            error={!!errors.date}
            helperText={errors.date ?? " "}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "import-income-date" } }}
          />

          <TextField
            size="small"
            fullWidth
            select
            label="Category"
            value={values.category}
            onChange={(event) => handleChange("category", event.target.value)}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "import-income-category" } }}
          >
            {INCOME_CATEGORY_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            fullWidth
            select
            required
            label="Payment mode"
            value={values.paymentMode}
            onChange={(event) => handleChange("paymentMode", event.target.value)}
            error={!!errors.paymentMode}
            helperText={errors.paymentMode ?? " "}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "import-income-mode" } }}
          >
            {PAYMENT_MODE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            fullWidth
            label="Payer"
            value={values.payer}
            onChange={(event) => handleChange("payer", event.target.value)}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "import-income-payer" } }}
          />

          <TextField
            size="small"
            fullWidth
            label="Reference"
            value={values.reference}
            onChange={(event) => handleChange("reference", event.target.value)}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "import-income-reference" } }}
          />
        </div>

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
          slotProps={{ htmlInput: { "data-testid": "import-income-notes" } }}
        />
      </DialogContent>

      <DialogActions className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onClose}
          disabled={isSaving}
          data-testid="import-income-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            void handleSave();
          }}
          disabled={isSaving || (!isEditing && !selected)}
          data-testid="import-income-save"
        >
          {isSaving && <CircularProgress size={16} thickness={5} aria-label="Saving" />}
          {isEditing ? "Save changes" : "Import income"}
        </button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportIncomeTaxDialog;

/** Re-exported so a caller can tell an imported income from a recorded one without importing
 *  the dialog itself. */
export { isImportedIncome } from "@/hooks/Income/useImportedIncomeFigures";