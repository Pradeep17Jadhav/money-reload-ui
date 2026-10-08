import { useCallback, useMemo } from "react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import classnames from "classnames";
import { Checkbox, FormControlLabel, InputAdornment, MenuItem, TextField } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import CurrencyRupee from "@mui/icons-material/CurrencyRupee";
import type { FieldConfig, FormValues } from "@/types/RecordFormTypes";
import { isFieldEnabled } from "@/helpers/recordForm";

import styles from "./Field.module.css";

export type FieldProps = {
  field: FieldConfig;
  value: string | boolean;
  error?: string;
  /** True while the field this one depends on is still empty. */
  disabled?: boolean;
  onChange: (name: string, value: string | boolean) => void;
  onBlur?: (name: string) => void;
};

/** Controls that want the full width of the dialog rather than half a row. */
const isWide = (field: FieldConfig): boolean =>
  field.kind === "text" && field.multiline === true;

/**
 * How a date is written in every date box on every record form.
 *
 * Day first, which is the order the rest of this app's dates are quoted in — `dd/mm/yyyy`, the
 * Indian convention the rupee and paise formatting already follows. MUI's own default is
 * `MM/DD/YYYY`, which reads `03/04/2026` as April the third to anyone who writes dates the other
 * way round, and a start date silently read a month early is the kind of mistake nobody notices
 * until a schedule has been built on it.
 *
 * A `format`, not a locale: it fixes the text and the placeholder without also reordering the
 * calendar's weekday columns, which is a separate change to make on purpose rather than as a
 * side effect of this one.
 */
const DATE_FORMAT = "DD/MM/YYYY";

/**
 * What an empty date box says about the order, which is the only place the order is visible
 * before anything has been typed.
 *
 * Spelled out separately rather than left to MUI, which has no entry for `DD/MM/YYYY` in its
 * default locale and so falls back to showing the format tokens themselves — the box would read
 * "DD/MM/YYYY", which looks like a mistake rather than an instruction.
 */
const DATE_PLACEHOLDER = "dd/mm/yyyy";

const messageClassName = (error?: string) =>
  classnames(styles.message, { [styles.errorMessage]: !!error });

/**
 * Renders one configured field. Each kind maps to the control that matches how
 * the API stores the value: money is typed in rupees but sent in paise, a
 * percentage never goes through the money path, and a date is a date-only
 * calendar date rather than a timestamp.
 */
const Field = ({ field, value, error, disabled = false, onChange, onBlur }: FieldProps) => {
  /**
   * Typed structurally rather than as a DOM `ChangeEvent`, because a MUI Select
   * raises its own event type while a TextField raises the DOM one. Both carry
   * the control's value on `target`.
   */
  const handleChange = useCallback(
    (event: { target: { value: string } }) => {
      onChange(field.name, event.target.value);
    },
    [field.name, onChange]
  );

  const handleSwitchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(field.name, event.target.checked);
    },
    [field.name, onChange]
  );

  const handleBlur = useCallback(() => {
    onBlur?.(field.name);
  }, [field.name, onBlur]);

  const stringValue = typeof value === "string" ? value : "";

  /**
   * A required field is marked with an asterisk; an optional one says nothing.
   *
   * The marker replaced a "(optional)" suffix on everything else, which said the same thing
   * about far more fields than it helped: on a form where most controls are optional, the word
   * repeated down the page and made the handful that *are* required the ones you had to look
   * for. A single mark on the few that demand something reads the other way round.
   *
   * `required` is absent on a switch, which is neither optional nor required in the same sense
   * — so it carries no mark.
   */
  const label =
    "required" in field && field.required ? `${field.label} *` : field.label;

  /**
   * Errors only. A blank space otherwise, because MUI reserves the helper row's height whether
   * or not it has text — so returning `undefined` would leave every field without an error
   * sitting a row shorter than its neighbours, and the whole form would shuffle the first time
   * a message appeared.
   */
  const helperText = error || " ";

  /**
   * A date field draws a real calendar rather than the browser's native date input.
   *
   * Native `<input type="date">` is rendered by the operating system, not by us: it cannot be
   * styled to match the rest of the form, and it is the one control in this dialog that
   * looks like it belongs to a different product.
   *
   * The stored value is still a plain `YYYY-MM-DD` string — the picker is a *drawing*, not a
   * change of contract — so `onChange` hands the field the same string the form has always
   * held, and every other kind of field is untouched by this.
   */
  if (field.kind === "date") {
    return (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className={styles.field}>
          <DatePicker
            data-testid={`field-${field.name}`}
            label={label}
            format={DATE_FORMAT}
            value={stringValue ? dayjs(stringValue) : null}
            onChange={(next: Dayjs | null) =>
              onChange(field.name, next ? next.format("YYYY-MM-DD") : "")
            }
            slotProps={{
              textField: {
                id: `field-${field.name}`,
                fullWidth: true,
                size: "small",
                onBlur: handleBlur,
                placeholder: DATE_PLACEHOLDER,
                error: !!error,
                disabled,
                helperText,
                FormHelperTextProps: { className: messageClassName(error) },
              },
            }}
          />
        </div>
      </LocalizationProvider>
    );
  }

  if (field.kind === "switch") {
    return (
      <FormControlLabel
        control={
          <Checkbox
            id={`field-${field.name}`}
            checked={value === true}
            onChange={handleSwitchChange}
            onBlur={handleBlur}
            disabled={disabled}
            data-testid={`field-${field.name}`}
          />
        }
        label={<span className={styles.switchLabel}>{field.label}</span>}
        className={styles.switchRow}
      />
    );
  }

  return (
    <div className={styles.field}>
      <TextField
        id={`field-${field.name}`}
        className={styles.input}
        data-testid={`field-${field.name}`}
        label={label}
        variant="outlined"
        size="small"
        fullWidth
        select={field.kind === "select"}
        multiline={isWide(field)}
        minRows={isWide(field) ? 3 : undefined}
        value={stringValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        type={
          field.kind === "money" || field.kind === "number" || field.kind === "percent"
            ? "number"
            : "text"
        }
        error={!!error}
        helperText={helperText}
        slotProps={{
          input: {
            startAdornment:
              field.kind === "money" ? (
                <InputAdornment position="start">
                  <CurrencyRupee fontSize="small" />
                </InputAdornment>
              ) : undefined,
          },
          htmlInput:
            field.kind === "percent"
              ? { step: "0.01", min: 0 }
              : field.kind === "number"
                ? { step: "1", min: field.min ?? 0 }
                : undefined,
          formHelperText: { className: messageClassName(error) },
        }}
      >
        {field.kind === "select"
          ? field.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))
          : null}
      </TextField>
    </div>
  );
};

/** Splits fields into rows of two, leaving wide controls on a row of their own. */
const toRows = (fields: FieldConfig[]): FieldConfig[][] => {
  const rows: FieldConfig[][] = [];

  for (const field of fields) {
    const current = rows[rows.length - 1];
    const previous = current?.[current.length - 1];

    if (!current || current.length === 2 || isWide(field) || (previous && isWide(previous))) {
      rows.push([field]);
      continue;
    }

    current.push(field);
  }

  return rows;
};

/** Renders the visible fields two to a row. */
const FieldGroup = ({
  fields,
  values,
  errors,
  onChange,
  onBlur,
}: {
  fields: FieldConfig[];
  values: FormValues;
  errors: Record<string, string>;
  onChange: (name: string, value: string | boolean) => void;
  onBlur?: (name: string) => void;
}) => {
  const rows = useMemo(() => toRows(fields), [fields]);

  return (
    <div className={styles.formGrid}>
      {rows.map((row, rowIndex) => (
        <div className={row.length > 1 ? styles.row : undefined} key={`row-${rowIndex}`}>
          {row.map((field) => (
            <Field
              key={field.name}
              field={field}
              value={values[field.name] ?? (field.kind === "switch" ? false : "")}
              error={errors[field.name]}
              disabled={!isFieldEnabled(field, values)}
              onChange={onChange}
              onBlur={onBlur}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export { Field, FieldGroup, isWide };
export default Field;