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
  /**
   * The value that makes this field appear.
   *
   * A list, as well as a single value, because one field often belongs to a *group* of values
   * rather than one: an investment's rate of return applies to every fixed-return type and to
   * none of the others. Repeating the field once per type would work and would be a list of
   * near-identical entries to keep in step; one entry with the group it belongs to says what it
   * means.
   */
  equals: string | boolean | Array<string | boolean>;
};

type FieldBase = {
  name: string;
  label: string;
  visibleWhen?: FieldVisibility;
  /**
   * A field the form owns but the API does not store.
   *
   * It exists to drive the fields that *are* stored, and its value is worked out from them, so
   * sending it would be sending a key the endpoint does not list — which every one of these
   * endpoints rejects outright. Excluded from the payload on create and from the
   * clears-a-hidden-field loop on edit.
   */
  formOnly?: boolean;
  /**
   * Disabled until the named field holds a value.
   *
   * The sibling of {@link FieldVisibility}, and deliberately a weaker condition: `visibleWhen`
   * asks "does this apply at all", this asks "is there anything yet to apply it to". An end
   * date with no start date has nothing to count from, so it is shown but cannot be set.
   */
  enabledWhen?: { name: string };
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
  /**
   * The options' values are numbers on the wire, not strings.
   *
   * A dropdown can only carry string values — that is what an `<option>` holds — so a control
   * picking from a closed set of *numbers* has to say so, or the chosen `"4"` goes to an API
   * expecting a number and comes back as `expected number, received string`.
   *
   * Opt-in rather than inferred, because a select whose values are genuinely strings — every
   * enum in this app — must keep being sent as strings.
   */
  numeric?: boolean;
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