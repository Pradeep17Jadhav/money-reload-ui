import type { Gender } from "@/types/AuthTypes";

/**
 * Declarative field descriptions for the record forms.
 *
 * Each resource supplies a list of these plus a payload builder, and one generic
 * renderer draws the form, validates it and turns it into the request body.
 * That keeps four CRUD forms from becoming four hand-maintained near-copies.
 */

/** Form state. Every control is a string, except the switches. */
export type FormValues = Record<string, string | boolean>;

export type FormErrors = Record<string, string>;

export type FieldVisibility = {
  /** Another field whose value decides whether this one is shown. */
  name: string;
  equals: string | boolean;
};

type FieldBase = {
  name: string;
  label: string;
  /** Renders in the message slot when there is no error. */
  helper?: string;
  visibleWhen?: FieldVisibility;
};

export type TextFieldConfig = FieldBase & {
  kind: "text";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  multiline?: boolean;
};

/** Rupees in, integer paise out. */
export type MoneyFieldConfig = FieldBase & {
  kind: "money";
  required?: boolean;
  /** `currentAmount` and `taxPaid` may legitimately be zero. */
  allowZero?: boolean;
};

/** A plain integer, such as `emiDay` or `tenureMonths`. Not money. */
export type NumberFieldConfig = FieldBase & {
  kind: "number";
  required?: boolean;
  min?: number;
  max?: number;
};

/** A percentage such as `interestRate`. Never treated as money. */
export type PercentFieldConfig = FieldBase & {
  kind: "percent";
  required?: boolean;
};

export type DateFieldConfig = FieldBase & {
  kind: "date";
  required?: boolean;
  /** Guards against picking a date before the loan starts, as `endDate` does. */
  min?: string;
  max?: string;
};

export type SelectFieldConfig = FieldBase & {
  kind: "select";
  required?: boolean;
  options: { value: string; label: string }[];
};

export type SwitchFieldConfig = FieldBase & {
  kind: "switch";
};

export type FieldConfig =
  | TextFieldConfig
  | MoneyFieldConfig
  | NumberFieldConfig
  | PercentFieldConfig
  | DateFieldConfig
  | SelectFieldConfig
  | SwitchFieldConfig;

/**
 * A rule the server enforces across two fields. The API returns these as
 * `validation_failed` with no `details`, so they are checked before submitting
 * rather than after a round trip.
 */
export type CrossFieldRule = {
  fields: [string, string];
  /** True when the pair is valid. */
  isValid: (values: FormValues) => boolean;
  message: string;
  /** The field the message is attached to. */
  attachTo: string;
};

export type GenderOption = { value: Gender; label: string };