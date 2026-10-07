import { formatDateOnly, todayAsDateOnly } from "@/helpers/dates";
import { validateMoneyInput } from "@/helpers/money";
import type { CrossFieldRule, FieldConfig, FormErrors, FormValues } from "@/types/RecordFormTypes";

/**
 * Turns form state into the request body the API expects.
 *
 * Two rules from the contract are enforced here rather than left to each
 * resource: money becomes integer paise, and a field the user left blank is
 * omitted entirely instead of being sent as `null` or `undefined`, because a
 * body carrying a key the endpoint does not list is rejected outright.
 */

export const getStringValue = (values: FormValues, name: string): string => {
  const value = values[name];
  return typeof value === "string" ? value : "";
};

export const getBooleanValue = (values: FormValues, name: string): boolean =>
  values[name] === true;

export const isFieldVisible = (field: FieldConfig, values: FormValues): boolean => {
  if (!field.visibleWhen) {
    return true;
  }

  return values[field.visibleWhen.name] === field.visibleWhen.equals;
};

/**
 * Fields the user can actually see and be held to, with the switches last.
 *
 * Checkboxes are a different kind of control from the fields above them, and
 * trailing them keeps every dialog reading the same way: details first, then the
 * declarations at the bottom.
 */
export const getVisibleFields = (
  fields: FieldConfig[],
  values: FormValues
): FieldConfig[] => {
  const visible = fields.filter((field) => isFieldVisible(field, values));

  return [
    ...visible.filter((field) => field.kind !== "switch"),
    ...visible.filter((field) => field.kind === "switch"),
  ];
};

export const validateField = (
  field: FieldConfig,
  values: FormValues
): string | undefined => {
  if (field.kind === "switch") {
    return undefined;
  }

  const raw = getStringValue(values, field.name);

  // Optional fields that were left blank are simply absent from the payload.
  if (!raw.trim()) {
    return field.required ? `${field.label} is required.` : undefined;
  }

  switch (field.kind) {
    case "money": {
      const { error } = validateMoneyInput(raw, { allowZero: field.allowZero });
      return error;
    }

    case "number": {
      const parsed = Number(raw);
      if (!Number.isInteger(parsed)) {
        return `${field.label} must be a whole number.`;
      }
      if (field.min !== undefined && parsed < field.min) {
        return `${field.label} must be at least ${field.min}.`;
      }
      if (field.max !== undefined && parsed > field.max) {
        return `${field.label} must be ${field.max} or less.`;
      }
      return undefined;
    }

    case "percent": {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        return `${field.label} must be a number.`;
      }
      if (parsed < 0 || parsed > 100) {
        return `${field.label} must be between 0 and 100.`;
      }
      return undefined;
    }

    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return "Choose a date.";
      }
      if (field.min && raw < field.min) {
        return `${field.label} must be on or after ${formatDateOnly(field.min)}.`;
      }
      if (field.max && raw > field.max) {
        return `${field.label} must be on or before ${formatDateOnly(field.max)}.`;
      }
      return undefined;
    }

    case "select":
      return field.options.some((option) => option.value === raw)
        ? undefined
        : `Choose ${field.label.toLowerCase()}.`;

    case "text":
    default: {
      const value = raw.trim();
      if (field.minLength !== undefined && value.length < field.minLength) {
        return `${field.label} must be at least ${field.minLength} characters.`;
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        return `${field.label} must be ${field.maxLength} characters or fewer.`;
      }
      return undefined;
    }
  }
};

export const validateForm = (
  fields: FieldConfig[],
  values: FormValues,
  crossFieldRules: CrossFieldRule[] = []
): FormErrors => {
  const errors: FormErrors = {};

  for (const field of getVisibleFields(fields, values)) {
    const message = validateField(field, values);
    if (message) {
      errors[field.name] = message;
    }
  }

  for (const rule of crossFieldRules) {
    // Only relevant while both halves of the rule are on screen.
    const bothVisible = rule.fields.every((name) =>
      fields.some((field) => field.name === name && isFieldVisible(field, values))
    );

    if (bothVisible && !rule.isValid(values) && !errors[rule.attachTo]) {
      errors[rule.attachTo] = rule.message;
    }
  }

  return errors;
};

export const hasFormErrors = (errors: FormErrors): boolean =>
  Object.values(errors).some((message) => typeof message === "string");

/**
 * Builds the request body.
 *
 * Blank optional fields are omitted rather than sent as `null`, and money is
 * converted to integer paise. Server-computed goal fields never appear because
 * they are not in the field list.
 */
export const buildPayload = (
  fields: FieldConfig[],
  values: FormValues
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};

  for (const field of getVisibleFields(fields, values)) {
    if (field.kind === "switch") {
      payload[field.name] = values[field.name] === true;
      continue;
    }

    const raw = getStringValue(values, field.name);

    if (!raw.trim()) {
      // An absent optional is not sent at all.
      continue;
    }

    switch (field.kind) {
      case "money": {
        const { paise } = validateMoneyInput(raw, { allowZero: field.allowZero });
        if (paise !== undefined) {
          payload[field.name] = paise;
        }
        break;
      }

      case "number":
      case "percent":
        payload[field.name] = Number(raw);
        break;

      case "date":
        payload[field.name] = raw;
        break;

      default:
        payload[field.name] = raw.trim();
    }
  }

  return payload;
};

/** The subset of keys the form is responsible for. */
export const getChangedKeys = (
  fields: FieldConfig[],
  original: FormValues,
  current: FormValues
): string[] =>
  fields
    .filter((field) => {
      if (field.kind === "switch") {
        return (original[field.name] === true) !== (current[field.name] === true);
      }
      return getStringValue(original, field.name) !== getStringValue(current, field.name);
    })
    .map((field) => field.name);

/**
 * For edit mode: only the fields whose values actually changed are sent.
 *
 * A field that has just become hidden is included as `null` when it previously
 * held a value. Without that, switching an expense from `installment` to `food`
 * would leave the loan type behind on the server, which then rejects the pair.
 */
export const buildUpdatePayload = (
  fields: FieldConfig[],
  original: FormValues,
  current: FormValues
): Record<string, unknown> => {
  const full = buildPayload(fields, current);
  const changed = new Set(getChangedKeys(fields, original, current));

  const payload: Record<string, unknown> = Object.fromEntries(
    Object.entries(full).filter(([key]) => changed.has(key))
  );

  for (const field of fields) {
    if (field.kind === "switch" || isFieldVisible(field, current)) {
      continue;
    }

    const hadValue = getStringValue(original, field.name).trim().length > 0;

    if (hadValue) {
      payload[field.name] = null;
    }
  }

  return payload;
};

/**
 * Seeds a form from an existing record. Money is rendered back into rupees for
 * editing, and a `null` becomes an empty string rather than the word "null".
 */
export const valuesFromRecord = (
  record: Record<string, unknown>,
  fields: FieldConfig[]
): FormValues => {
  const values: FormValues = {};

  for (const field of fields) {
    if (field.kind === "switch") {
      values[field.name] = record[field.name] === true;
      continue;
    }

    const raw = record[field.name];

    if (raw === null || raw === undefined) {
      values[field.name] = "";
      continue;
    }

    if (field.kind === "money") {
      // Paise back to rupees, without a trailing `.00` the user did not type.
      const rupees = Number(raw) / 100;
      values[field.name] = Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
      continue;
    }

    values[field.name] = String(raw);
  }

  return values;
};

export const emptyValues = (fields: FieldConfig[]): FormValues => {
  const values: FormValues = {};

  for (const field of fields) {
    values[field.name] = field.kind === "switch" ? false : "";
  }

  return values;
};

/** Today, the common default for a new income or expense entry. */
export const withTodayDefault = (values: FormValues, dateField = "date"): FormValues => ({
  ...values,
  [dateField]: todayAsDateOnly(),
});