import { useCallback, useMemo } from "react";
import classnames from "classnames";
import { Checkbox, FormControlLabel, InputAdornment, MenuItem, TextField } from "@mui/material";
import CurrencyRupee from "@mui/icons-material/CurrencyRupee";
import type { FieldConfig, FormValues } from "@/types/RecordFormTypes";

import styles from "./Field.module.css";

export type FieldProps = {
  field: FieldConfig;
  value: string | boolean;
  error?: string;
  onChange: (name: string, value: string | boolean) => void;
  onBlur?: (name: string) => void;
};

/** Controls that want the full width of the dialog rather than half a row. */
const isWide = (field: FieldConfig): boolean =>
  field.kind === "text" && field.multiline === true;

const messageClassName = (error?: string) =>
  classnames(styles.message, { [styles.errorMessage]: !!error });

/**
 * Renders one configured field. Each kind maps to the control that matches how
 * the API stores the value: money is typed in rupees but sent in paise, a
 * percentage never goes through the money path, and a date is a date-only
 * calendar date rather than a timestamp.
 */
const Field = ({ field, value, error, onChange, onBlur }: FieldProps) => {
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

  if (field.kind === "switch") {
    return (
      <FormControlLabel
        control={
          <Checkbox
            id={`field-${field.name}`}
            checked={value === true}
            onChange={handleSwitchChange}
            onBlur={handleBlur}
            data-testid={`field-${field.name}`}
          />
        }
        label={<span className={styles.switchLabel}>{field.label}</span>}
        className={styles.switchRow}
      />
    );
  }

  /**
   * Optional fields say so on the label. A blank optional is omitted from the
   * request body entirely, so without this it reads as though leaving it empty
   * would be a mistake.
   */
  const label = field.required ? field.label : `${field.label} (optional)`;

  const helperText = error || field.helper || " ";

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
        type={
          field.kind === "money" || field.kind === "number" || field.kind === "percent"
            ? "number"
            : "text"
        }
        error={!!error}
        helperText={helperText}
        slotProps={{
          inputLabel: field.kind === "date" ? { shrink: true } : undefined,
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