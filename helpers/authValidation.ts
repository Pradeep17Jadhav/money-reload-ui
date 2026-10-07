import { Gender } from "@/types/AuthTypes";
import { isCountryCode } from "@/helpers/countries";

export type LoginFormValues = {
  /** A username or an email in a single field. Never normalised before sending. */
  identifier: string;
  password: string;
};

export type RegisterFormValues = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  country: string;
  gender: Gender | "";
  password: string;
  confirmPassword: string;
  /**
   * Client-side consent only. The register contract rejects any property it
   * does not list, so this is validated but deliberately never sent.
   */
  acceptedTerms: boolean;
};

export type FieldErrors<TValues> = Partial<Record<keyof TValues, string>>;

export const LOGIN_INITIAL_VALUES: LoginFormValues = {
  identifier: "",
  password: "",
};

export const REGISTER_INITIAL_VALUES: RegisterFormValues = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  country: "",
  gender: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+(\.[^\s@]+)+$/;
const LETTER_PATTERN = /[a-zA-Z]/;
const DIGIT_PATTERN = /\d/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const EMAIL_MAX_LENGTH = 254;
export const NAME_MAX_LENGTH = 50;
export const PASSWORD_MIN_LENGTH = 8;
/** The server caps passwords at 72 UTF-8 bytes, not characters. */
export const PASSWORD_MAX_BYTES = 72;

export const getUtf8ByteLength = (value: string): number =>
  new TextEncoder().encode(value).length;

const hasValue = (value: string): boolean => value.trim().length > 0;

export const validateIdentifier = (value: string): string | undefined => {
  if (!hasValue(value)) {
    return "Enter your username or email address.";
  }

  const identifier = value.trim();

  // Validated against the union of both rules rather than branching on which
  // one it is, so a value accepted here can never be rejected at the boundary.
  const looksLikeEmail = identifier.includes("@");
  if (looksLikeEmail) {
    return validateEmail(identifier);
  }

  return validateUsername(identifier);
};

export const validateUsername = (value: string): string | undefined => {
  if (!hasValue(value)) {
    return "Enter a username.";
  }

  const username = value.trim();
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters.`;
  }

  if (!USERNAME_PATTERN.test(username)) {
    return "Username can only contain letters, numbers, dots and underscores.";
  }

  return undefined;
};

export const validateEmail = (value: string): string | undefined => {
  if (!hasValue(value)) {
    return "Enter an email address.";
  }

  const email = value.trim();
  if (email.length > EMAIL_MAX_LENGTH) {
    return `Email address must be ${EMAIL_MAX_LENGTH} characters or fewer.`;
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address.";
  }

  return undefined;
};

export const validateName = (value: string, label: string): string | undefined => {
  if (!hasValue(value)) {
    return `Enter a ${label}.`;
  }

  if (value.trim().length > NAME_MAX_LENGTH) {
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} must be ${NAME_MAX_LENGTH} characters or fewer.`;
  }

  return undefined;
};

export const validateCountry = (value: string): string | undefined => {
  if (!hasValue(value)) {
    return "Select your country.";
  }

  if (!isCountryCode(value)) {
    return "Select a country from the list.";
  }

  return undefined;
};

export const validateGender = (value: Gender | ""): string | undefined =>
  value ? undefined : "Select an option.";

export const validatePassword = (value: string): string | undefined => {
  if (!value.length) {
    return "Enter a password.";
  }

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (getUtf8ByteLength(value) > PASSWORD_MAX_BYTES) {
    return "Password is too long. Use at most 72 characters of standard text.";
  }

  if (!LETTER_PATTERN.test(value) || !DIGIT_PATTERN.test(value)) {
    return "Password needs at least one letter and one number.";
  }

  return undefined;
};

export const validateConfirmPassword = (
  value: string,
  password: string
): string | undefined => {
  if (!value.length) {
    return "Confirm your password.";
  }

  if (value !== password) {
    return "Passwords do not match.";
  }

  return undefined;
};

export const validateTerms = (accepted: boolean): string | undefined =>
  accepted ? undefined : "You need to accept the terms to continue.";

export const validateLoginForm = (values: LoginFormValues): FieldErrors<LoginFormValues> => ({
  identifier: validateIdentifier(values.identifier),
  // Login only requires a non-empty password. The server does not re-check
  // complexity, so a password that predates the current rules still signs in.
  password: values.password.length ? undefined : "Enter your password.",
});

export const validateRegisterForm = (
  values: RegisterFormValues
): FieldErrors<RegisterFormValues> => ({
  firstName: validateName(values.firstName, "first name"),
  lastName: validateName(values.lastName, "last name"),
  username: validateUsername(values.username),
  email: validateEmail(values.email),
  country: validateCountry(values.country),
  gender: validateGender(values.gender),
  password: validatePassword(values.password),
  confirmPassword: validateConfirmPassword(values.confirmPassword, values.password),
  acceptedTerms: validateTerms(values.acceptedTerms),
});

export const hasErrors = <TValues,>(errors: FieldErrors<TValues>): boolean =>
  Object.values(errors).some((message) => typeof message === "string");

/**
 * Unmet requirements, in the order they are explained. Empty means the password
 * satisfies everything the server will check.
 */
export const getUnmetPasswordRules = (value: string): string[] => {
  const unmet: string[] = [];

  if (value.length && value.length < PASSWORD_MIN_LENGTH) {
    unmet.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (value.length && !LETTER_PATTERN.test(value)) {
    unmet.push("one letter");
  }
  if (value.length && !DIGIT_PATTERN.test(value)) {
    unmet.push("one number");
  }
  if (getUtf8ByteLength(value) > PASSWORD_MAX_BYTES) {
    unmet.push(`no more than ${PASSWORD_MAX_BYTES} bytes`);
  }

  return unmet;
};