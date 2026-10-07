"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import { AmortisationTableFrequency } from "@/types/Loan/LoanTypes";
import type { AmortisationRow, MonthOverride } from "@/types/Loan/LoanTypes";
import InputAdornment from "@mui/material/InputAdornment";
import CurrencyRupee from "@mui/icons-material/CurrencyRupee";
import { getPrintableMonthYear } from "@/components/Common/LoanCalculator/helpers/loan";
import { MAX_ROI, MIN_ROI } from "@/constants/calculator";
import { sanitizeROI } from "@/helpers/numbers";
import { useCurrency } from "@/contexts/currency";

import styles from "./AmortisationMonthDialog.module.css";

type Props = {
  open: boolean;
  /** The month being edited, or null while the dialog is closed. */
  month: AmortisationRow | null;
  /** What the user had already changed on this month. */
  change: MonthOverride;
  /** What was still owed before this month's instalment. */
  openingBalance: number;
  onClose: () => void;
  onApply: (change: MonthOverride) => void;
  /** Drops any stored change for this month. The dialog stays open. */
  onResetMonth: () => void;
};

type FieldName = keyof MonthOverride;

const FIELDS: {
  name: FieldName;
  label: string;
  hint: string;
  kind: "money" | "rate";
}[] = [
  { name: "emi", label: "EMI", kind: "money", hint: "Applies to this month onwards." },
  {
    name: "prepayment",
    label: "Prepayment",
    kind: "money",
    hint: "This month only.",
  },
  {
    name: "disbursement",
    label: "Additional disbursement",
    kind: "money",
    hint: "Adds to the principal from this month onwards.",
  },
  { name: "roi", label: "Rate of interest", kind: "rate", hint: "Annual %." },
];

type FormValues = Record<FieldName, string>;

const round = (value: number): number => Math.round(value);

/** Numbers trimmed of trailing zeros so "0" does not read as "0.00". */
const toInput = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

/**
 * Edits one month of the schedule.
 *
 * Each field opens showing what is already in force for that month, so the user
 * reads the current state rather than inferring it. Apply stays disabled until
 * something actually differs, and only the fields that differ are sent — a month
 * that changes just the instalment keeps inheriting whatever rate came before it.
 */
const AmortisationMonthDialog = ({
  open,
  month,
  change,
  openingBalance,
  onClose,
  onApply,
  onResetMonth,
}: Props) => {
  const { formatAmount } = useCurrency();
  const [values, setValues] = useState<FormValues>({
    emi: "",
    prepayment: "",
    disbursement: "",
    roi: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});

  /**
   * What is in force right now, which is both the prefill and the baseline the
   * edited values are compared against.
   */
  const inForce = useMemo<FormValues>(
    () => ({
      emi: month ? toInput(round(month.emi)) : "",
      prepayment: month ? toInput(round(month.prepayments)) : "",
      disbursement: month ? toInput(round(month.disbursements)) : "",
      roi: month ? toInput(month.interestRate) : "",
    }),
    [month]
  );

  const initialRef = useRef<FormValues>(inForce);
  const monthIndexRef = useRef<number | null>(null);

  // Reseeded when a different month is opened, and when the values in force move
  // underneath the form, which is what happens when a change is reset.
  useEffect(() => {
    if (!open || !month) {
      return;
    }

    const movedOn = monthIndexRef.current !== month.monthIndex;
    const valuesMoved = FIELDS.some(
      (field) => initialRef.current[field.name] !== inForce[field.name]
    );

    if (movedOn || valuesMoved) {
      monthIndexRef.current = month.monthIndex;
      initialRef.current = inForce;
      setValues(inForce);
      setErrors({});
    }
  }, [inForce, month, open]);

  const parse = useCallback((raw: string): number => {
    const trimmed = raw.trim();
    return trimmed === "" ? Number.NaN : Number(trimmed);
  }, []);

  /** Only what the user actually changed, so inherited values stay inherited. */
  const buildChange = useCallback((): MonthOverride => {
    const change: MonthOverride = {};

    if (parse(values.emi) !== parse(initialRef.current.emi)) {
      change.emi = parse(values.emi);
    }
    if (parse(values.prepayment) !== parse(initialRef.current.prepayment)) {
      change.prepayment = parse(values.prepayment);
    }
    if (
      parse(values.disbursement) !== parse(initialRef.current.disbursement)
    ) {
      change.disbursement = parse(values.disbursement);
    }
    if (parse(values.roi) !== parse(initialRef.current.roi)) {
      change.roi = Number(sanitizeROI(values.roi.trim()));
    }

    return change;
  }, [initialRef, parse, values]);

  const isDirty = useMemo(
    () =>
      FIELDS.some(
        (field) => parse(values[field.name]) !== parse(initialRef.current[field.name])
      ),
    [initialRef, parse, values]
  );

  const handleChange = useCallback((name: FieldName, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) {
        return current;
      }
      const { [name]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const handleApply = useCallback(() => {
    const nextErrors: Partial<Record<FieldName, string>> = {};

    for (const field of FIELDS) {
      const parsed = parse(values[field.name]);

      if (Number.isNaN(parsed)) {
        nextErrors[field.name] = `${field.label} must be a number.`;
        continue;
      }

      if (field.kind === "money" && parsed < 0) {
        nextErrors[field.name] = `${field.label} cannot be negative.`;
        continue;
      }

      if (field.kind === "rate" && (parsed < MIN_ROI || parsed > MAX_ROI)) {
        nextErrors[field.name] = `Rate must be between ${MIN_ROI} and ${MAX_ROI}.`;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onApply(buildChange());
  }, [buildChange, onApply, parse, values]);

  /**
   * Puts the values that are in force back, and drops anything stored for this
   * month. The dialog stays open so the effect can refill it.
   */
  const handleReset = useCallback(() => {
    onResetMonth();
    setValues(initialRef.current);
    setErrors({});
  }, [onResetMonth]);

  const readOnlyEntries = useMemo(() => {
    if (!month) {
      return [];
    }

    const entries = [
      { label: "Opening balance", value: formatAmount(openingBalance) },
      { label: "Principal", value: formatAmount(month.principalPaid) },
      { label: "Interest", value: formatAmount(month.interestPaid) },
      { label: "Prepayments", value: formatAmount(month.prepayments) },
    ];

    // Only worth a row when there is something advanced, which is most months.
    if (month.disbursements > 0) {
      entries.push({
        label: "Additional disbursement",
        value: formatAmount(month.disbursements),
      });
    }

    entries.push(
      { label: "Total payment", value: formatAmount(month.totalPaid) },
      { label: "Closing balance", value: formatAmount(month.balance) }
    );

    return entries;
  }, [formatAmount, month, openingBalance]);

  const monthLabel = month
    ? `${getPrintableMonthYear(AmortisationTableFrequency.Monthly, month.year, true)} (month ${
        month.monthIndex + 1
      })`
    : "";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit {monthLabel}</DialogTitle>

      <DialogContent>
        <div className={styles.readOnly} data-testid="amortisation-month-info">
          <div className={styles.readOnlyGrid}>
            {readOnlyEntries.map((entry) => (
              <div key={entry.label}>
                <div className={styles.readOnlyLabel}>{entry.label}</div>
                <div className={styles.readOnlyValue}>{entry.value}</div>
              </div>
            ))}
          </div>
        </div>

        <p className={styles.hint}>
          An EMI or rate change applies from this month to the end of the tenure. A prepayment
          or additional disbursement applies to this month only.
        </p>

        {FIELDS.map((field) => {
          const error = errors[field.name];

          return (
            <div className={styles.field} key={field.name}>
              <TextField
                id={`amortisation-${field.name}`}
                label={field.label}
                type="number"
                variant="outlined"
                size="small"
                fullWidth
                value={values[field.name]}
                onChange={(event) => handleChange(field.name, event.target.value)}
                error={!!error}
                helperText={error || field.hint}
                slotProps={{
                  htmlInput: {
                    // On the control itself, so a query finds the input rather
                    // than the wrapper.
                    "data-testid": `amortisation-${field.name}`,
                    ...(field.kind === "rate"
                      ? { step: "0.01", min: MIN_ROI, max: MAX_ROI }
                      : { step: "1", min: 0 }),
                  },
                  input:
                    field.kind === "money"
                      ? {
                          startAdornment: (
                            <InputAdornment position="start">
                              <CurrencyRupee fontSize="small" />
                            </InputAdornment>
                          ),
                        }
                      : {
                          // A rate is a percentage, so it reads with a trailing %.
                          endAdornment: (
                            <InputAdornment position="end">%</InputAdornment>
                          ),
                        },
                  formHelperText: {
                    className: classnames(styles.message, {
                      [styles.error]: !!error,
                    }),
                  },
                }}
              />
            </div>
          );
        })}
      </DialogContent>

      <DialogActions className={styles.actions}>
        <button
          type="button"
          className={styles.resetButton}
          onClick={handleReset}
          data-testid="amortisation-reset"
        >
          Reset
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onClose}
          data-testid="amortisation-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleApply}
          disabled={!isDirty}
          data-testid="amortisation-apply"
        >
          Apply
        </button>
      </DialogActions>
    </Dialog>
  );
};

export default AmortisationMonthDialog;