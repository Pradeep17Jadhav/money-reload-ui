"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
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
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { useAuth } from "@/contexts/authContext";
import { getAuthErrorCopy } from "@/helpers/apiErrors";
import { formatPaise } from "@/helpers/money";
import { listLoans, listExpenses, createExpense, updateExpense } from "@/services/finance/records";
import {
  MAX_PAGE_LIMIT,
  PAYMENT_MODE_OPTIONS,
  labelForEnumValue,
} from "@/constants/records";
import { CellStack } from "@/components/Records/RecordTable/RecordTable";
import { useImportedLoanFigures } from "@/components/Loans/useImportedLoanFigures";
import { ExpenseCategory, RecurrenceFrequency } from "@/types/FinanceTypes";
import type { Expense, Loan, PaymentMode } from "@/types/FinanceTypes";

import styles from "./LoanExpenseDialog.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called once the expense is saved, so the list can re-read it. */
  onSaved: () => void;
  /**
   * The expense being edited, or `null` to create one.
   *
   * The same dialog for both, deliberately. A linked expense's amount, category and kind come
   * from its loan, so the generic edit form would either offer fields that must not be set or
   * quietly drop them. Editing here instead keeps one form and one rule.
   */
  expense: Expense | null;
};

type TypedField = "title" | "paymentMode" | "isEssential" | "notes";

/**
 * Whether this expense carries figures of its own, or reads them from a loan.
 *
 * The single thing the two modes differ on, and the reason there is one dialog: a linked
 * expense's amount is not editable, because the loan's amortisation owns it.
 */
const readsFromLoan = (expense: Expense | null): boolean =>
  expense !== null && typeof expense.loanId === "string" && expense.loanId.length > 0;

const LoanExpenseDialog = ({ open, onClose, onSaved, expense }: Props) => {
  const { authorisedRequest } = useAuth();
  const isEditing = expense !== null;
  const isLinked = readsFromLoan(expense);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [alreadyRecorded, setAlreadyRecorded] = useState<Set<string>>(new Set());
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [values, setValues] = useState<Record<TypedField, string | boolean>>({
    title: "",
    paymentMode: "",
    isEssential: false,
    notes: "",
  });
  const [errors, setErrors] = useState<Partial<Record<TypedField, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { figuresFor } = useImportedLoanFigures(loans, 0);

  // Reopened, or opened on a different expense, so it must not carry the last one's answers.
  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedId(expense?.loanId ?? "");
    setValues({
      title: expense?.title ?? "",
      paymentMode: expense?.paymentMode ?? "",
      isEssential: expense?.isEssential ?? false,
      notes: expense?.notes ?? "",
    });
    setErrors({});
    setBanner(null);
  }, [expense, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const today = dayjs();

    const run = async () => {
      setIsLoadingLoans(true);
      setListError(null);

      try {
        /*
         * The loans, and the loans that already have an instalment recorded *for this month*.
         *
         * Scoped to the month deliberately. "Already added" cannot mean "ever added": an
         * instalment is a monthly thing, so a loan recorded in March has to come back in
         * April or the user could only ever record one per loan, ever. Last month's row stays
         * where it is, and this month's is what gets replaced.
         *
         * The expense being edited is excluded from its own filter — otherwise opening it to
         * correct a typo would hide the very loan it is about.
         */
        const [loanList, monthExpenses] = await Promise.all([
          listLoans(authorisedRequest, { limit: MAX_PAGE_LIMIT }),
          listExpenses(authorisedRequest, {
            from: today.startOf("month").format("YYYY-MM-DD"),
            to: today.endOf("month").format("YYYY-MM-DD"),
            limit: MAX_PAGE_LIMIT,
          }),
        ]);

        if (cancelled) {
          return;
        }

        setLoans(loanList.items);
        setAlreadyRecorded(
          new Set(
            monthExpenses.items
              .filter((item) => item.id !== expense?.id && typeof item.loanId === "string")
              .map((item) => item.loanId as string)
          )
        );
      } catch (thrown) {
        if (!cancelled) {
          setListError(getAuthErrorCopy(thrown).banner);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLoans(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authorisedRequest, expense?.id, open]);

  /**
 * Loans worth offering: ones with an instalment, and ones not already recorded this month.
   *
   * A loan already on this month's list is left out rather than disabled, so the user is not
   * offered something that would create a duplicate. Nothing is said about what was left out —
   * the list shows what is available, and a loan reappears next month on its own.
   */
  const { selectable, alreadyDone } = useMemo(() => {
    const payable: Loan[] = [];
    const recorded: Loan[] = [];

    for (const loan of loans) {
      const { emiAmount } = figuresFor(loan);

      if (emiAmount === null || emiAmount <= 0) {
        continue;
      }

      if (alreadyRecorded.has(loan.id)) {
        recorded.push(loan);
      } else {
        payable.push(loan);
      }
    }

    return { selectable: payable, alreadyDone: recorded };
  }, [alreadyRecorded, figuresFor, loans]);

  const selectedLoan = useMemo(
    () => selectable.find((loan) => loan.id === selectedId) ?? null,
    [selectable, selectedId]
  );

  /**
   * What the loan says this costs, and which month it belongs to.
   *
   * Shown rather than asked for. The month is **not** an input: an instalment belongs to the
   * month the schedule says it falls due, and a loan that has not started yet is read at its
   * own first month rather than at today — dating it into a month it is not payable in would
   * book an instalment that has not happened.
   */
  const derived = useMemo(() => {
    if (!selectedLoan) {
      return null;
    }

    const { emiAmount, startDate, activeMonth } = figuresFor(selectedLoan);

    if (!emiAmount || emiAmount <= 0) {
      return null;
    }

    const today = dayjs();
    const loanStart = dayjs(startDate);
    const month = activeMonth
      ? dayjs(`${activeMonth}-01`)
      : today.isBefore(loanStart, "month")
        ? loanStart
        : today;

    return { amount: emiAmount, date: month.format("YYYY-MM-DD"), month: month.format("MMMM YYYY") };
  }, [figuresFor, selectedLoan]);

  const handleSelect = useCallback(
    (event: SelectChangeEvent<string>) => {
      setSelectedId(event.target.value);
    },
    []
  );

  const handleChange = useCallback(
    (field: TypedField, value: string | boolean) => {
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => {
        if (!current[field]) {
          return current;
        }
        const { [field]: _cleared, ...rest } = current;

        return rest;
      });
    },
    []
  );

  const handleSave = useCallback(async () => {
    const nextErrors: Partial<Record<TypedField, string>> = {};
    const title = String(values.title).trim();

    if (!title) {
      nextErrors.title = "Give this expense a name.";
    }

    const paymentMode = String(values.paymentMode);

    if (!paymentMode) {
      nextErrors.paymentMode = "How was this paid?";
    }

    if (!derived) {
      setBanner("Pick a loan to record an instalment for.");

      return;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);

      return;
    }

    setIsSaving(true);
    setBanner(null);

    /*
     * The fields a loan cannot answer. Everything about the loan itself — amount, category,
     * which kind of loan — is deliberately absent: it is read from the loan on every read, so
     * storing a copy would be a second source of truth that goes stale the moment the
     * calculation is re-rated.
     *
     * `date` is the one figure sent rather than asked for. It is structural — the API indexes,
     * date-filters and sorts on it — and it is always the month the loan's own schedule says
     * this instalment falls due, so it cannot disagree with the amount resolved from it.
     */
    const payload: Record<string, unknown> = {
      title,
      date: derived.date,
      paymentMode: paymentMode as PaymentMode,
      isEssential: values.isEssential === true,
      loanId: selectedId.length > 0 ? selectedId : null,
      ...(String(values.notes).trim() ? { notes: String(values.notes).trim() } : {}),
    };

    /*
     * Only for a linked expense, and only the two recurrence flags — an instalment is a
     * standing monthly payment, so there is nothing to ask. `amount`, `category` and
     * `installmentType` are absent from the payload above and must stay absent: the API
     * refuses them beside a `loanId`, and rightly so.
     */
    if (selectedId.length > 0) {
      payload["isRecurring"] = true;
      payload["recurrenceFrequency"] = RecurrenceFrequency.MONTHLY;
    }

    try {
      if (isEditing && expense) {
        await updateExpense(authorisedRequest, expense.id, payload);
      } else {
        await createExpense(authorisedRequest, payload);
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
  }, [authorisedRequest, derived, expense, isEditing, onClose, onSaved, selectedId, values]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      data-testid="loan-expense-dialog"
    >
      <DialogTitle>
        {isEditing
          ? isLinked
            ? "Edit loan instalment"
            : "Edit expense"
          : "Record a loan instalment as an expense"}
      </DialogTitle>

      <DialogContent>
        {banner && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="loan-expense-banner">
            {banner}
          </Alert>
        )}

        <div className={styles.field}>
          <FormControl fullWidth size="small" error={!!listError}>
            <InputLabel id="expense-loan-label">Loan</InputLabel>
            <Select
              labelId="expense-loan-label"
              id="expense-loan"
              label="Loan"
              value={selectedId}
              onChange={handleSelect}
              disabled={isLoadingLoans || selectable.length === 0}
              inputProps={{ "data-testid": "expense-loan-select" }}
            >
              {/*
                The loan's **title**, not its lender. One bank issues many loans, so the
                lender does not tell a user's own loans apart — the title is the name they
                gave this one. The lender stays as the quieter second line, both because it
                is the other half of what identifies a loan elsewhere in the app and because
                two loans can legitimately share a title.
              */}
              {selectable.map((loan) => (
                <MenuItem key={loan.id} value={loan.id}>
                  <CellStack primary={loan.title} secondary={loan.lender} />
                </MenuItem>
              ))}
            </Select>
            {listError && (
              <p className={styles.error} role="alert">
                {listError}
              </p>
            )}
            {!isLoadingLoans && !listError && selectable.length === 0 && (
              <p className={styles.helper} data-testid="expense-no-loans">
                {alreadyDone.length > 0
                  ? "Every loan with an instalment is already recorded for this month."
                  : "No loans with a monthly instalment. Record this payment as an ordinary expense instead."}
              </p>
            )}
          </FormControl>
        </div>

        {/*
          * What the loan says this costs. A panel, not disabled inputs: these are not locked
          * against being changed, they simply are not this form's to set — the month below is
          * stored, and the figure comes back from the loan on every read.
          */}
        {derived && (
          <div className={styles.derived} data-testid="expense-derived">
            <p className={styles.derivedTitle}>From {selectedLoan?.title}</p>
            <dl className={styles.derivedGrid}>
              <div>
                <dt>Instalment</dt>
                <dd>{formatPaise(derived.amount)}</dd>
              </div>
              <div>
                <dt>Filed as</dt>
                {/*
                  * From the same humaniser the table uses, rather than a literal. Hardcoding
                  * "Instalment" here had the dialog disagreeing with the column it writes
                  * into — one L short, and a second spelling of the same word.
                 */}
                <dd>{labelForEnumValue(ExpenseCategory.INSTALLMENT)}</dd>
              </div>
              <div>
                <dt>Month</dt>
                <dd>{derived.month}</dd>
              </div>
            </dl>
          </div>
        )}

        {/*
          * Title and payment mode share a row. Title used to be rendered a second time on its
          * own above this grid — two inputs bound to one value, under one `data-testid`, so
          * typing in either updated both and neither could be addressed unambiguously. One
          * field, in the grid beside the mode it belongs with.
          */}
        <div className={styles.grid}>
          <TextField
            size="small"
            fullWidth
            required
            label="Title"
            value={String(values.title)}
            onChange={(event) => handleChange("title", event.target.value)}
            error={!!errors.title}
            helperText={errors.title ?? " "}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "expense-title" } }}
          />

          <TextField
            size="small"
            fullWidth
            select
            required
            label="Payment mode"
            value={String(values.paymentMode)}
            onChange={(event) => handleChange("paymentMode", event.target.value)}
            error={!!errors.paymentMode}
            helperText={errors.paymentMode ?? " "}
            disabled={isSaving}
            slotProps={{ htmlInput: { "data-testid": "expense-mode" } }}
          >
            {PAYMENT_MODE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </div>

        <FormControlLabel
          control={
            <Checkbox
              checked={values.isEssential === true}
              onChange={(event) => handleChange("isEssential", event.target.checked)}
              disabled={isSaving}
            />
          }
          label="This is an essential expense"
        />

        <TextField
          size="small"
          fullWidth
          multiline
          minRows={2}
          label="Notes"
          value={String(values.notes)}
          onChange={(event) => handleChange("notes", event.target.value)}
          disabled={isSaving}
          sx={{ mt: 2 }}
          slotProps={{ htmlInput: { "data-testid": "expense-notes" } }}
        />
      </DialogContent>

      <DialogActions className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onClose}
          disabled={isSaving}
          data-testid="expense-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            void handleSave();
          }}
          disabled={isSaving}
          data-testid="expense-save"
        >
          {isSaving && <CircularProgress size={16} thickness={5} aria-label="Saving" />}
          {isEditing ? "Save changes" : "Add expense"}
        </button>
      </DialogActions>
    </Dialog>
  );
};

export default LoanExpenseDialog;