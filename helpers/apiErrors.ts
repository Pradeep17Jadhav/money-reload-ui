import { AuthErrorCode, ROOT_FIELD } from "@/types/AuthTypes";
import type { AuthErrorDetail } from "@/types/AuthTypes";
import { isApiError } from "@/services/auth";

export type AuthErrorCopy = {
  /** Form-level message for the banner. Null when the error is only field-level. */
  banner: string | null;
  /** Messages keyed by the API's field name, for rendering on an input. */
  fields: Record<string, string>;
};

/**
 * One message for every way a login can fail. The API answers an unknown
 * username, an unknown email and a wrong password with the same
 * `invalid_credentials` code, and the UI must not reintroduce the distinction
 * it was careful to remove.
 */
export const INVALID_CREDENTIALS_MESSAGE =
  "We could not sign you in with that username or email and password. Check the details and try again.";

export const GENERIC_MESSAGE = "Something went wrong on our side. Please try again.";

const BANNER_BY_CODE: Partial<Record<AuthErrorCode, string>> = {
  [AuthErrorCode.INVALID_CREDENTIALS]: INVALID_CREDENTIALS_MESSAGE,
  [AuthErrorCode.TOKEN_MISSING]:
    "Your session is no longer available. Sign in again to continue.",
  [AuthErrorCode.TOKEN_INVALID]:
    "Your session is no longer valid. Sign in again to continue.",
  [AuthErrorCode.SESSION_REVOKED]:
    "Your session was ended. Sign in again to continue.",
  [AuthErrorCode.TOKEN_EXPIRED]: "Your session has expired. Sign in again to continue.",
  [AuthErrorCode.USER_NOT_FOUND]: "We could not find that account. Sign in again to continue.",
  // A record belonging to another user returns the same 404 as one that does not
  // exist, so the copy must never imply the record exists elsewhere.
  [AuthErrorCode.LOAN_NOT_FOUND]:
    "This loan is no longer available. It may have been deleted.",
  [AuthErrorCode.INCOME_NOT_FOUND]:
    "This income entry is no longer available. It may have been deleted.",
  [AuthErrorCode.EXPENSE_NOT_FOUND]:
    "This expense is no longer available. It may have been deleted.",
  [AuthErrorCode.GOAL_NOT_FOUND]:
    "This goal is no longer available. It may have been deleted.",
  [AuthErrorCode.CONFLICT]:
    "That change conflicts with something we already have. Review your details and try again.",
  [AuthErrorCode.PAYLOAD_TOO_LARGE]:
    "The details you sent were too large. Shorten them and try again.",
  [AuthErrorCode.DATABASE_UNAVAILABLE]:
    "Our database is briefly unavailable. Please try again in a moment.",
  [AuthErrorCode.DATABASE_ERROR]: GENERIC_MESSAGE,
  [AuthErrorCode.INTERNAL_ERROR]: GENERIC_MESSAGE,
  [AuthErrorCode.NETWORK_ERROR]:
    "We could not reach the server. Check your connection and try again.",
};

/** Codes that describe a single field rather than the submission as a whole. */
const FIELD_BY_CODE: Partial<Record<AuthErrorCode, string>> = {
  [AuthErrorCode.USERNAME_TAKEN]: "username",
  [AuthErrorCode.EMAIL_TAKEN]: "email",
};

const isRootDetail = (detail: AuthErrorDetail): boolean => detail.field === ROOT_FIELD;

const toFieldMessage = (detail: AuthErrorDetail): string =>
  detail.message.trim().length > 0
    ? detail.message
    : "Please check this field and try again.";

/**
 * Pure translation of a rejection into what the user should read. Every rule
 * lives here so no component branches on an error code, and no error code ever
 * reaches the user.
 *
 * `details` is optional in the contract, so a validation failure with no
 * details still produces a usable banner.
 */
export const getAuthErrorCopy = (error: unknown): AuthErrorCopy => {
  if (!isApiError(error)) {
    return { banner: GENERIC_MESSAGE, fields: {} };
  }

  // A problem with the request object as a whole belongs on the banner; anything
  // naming a property belongs on that input.
  const rootDetail = error.details.find(isRootDetail);

  const fieldErrors: Record<string, string> = {};

  for (const detail of error.details) {
    if (isRootDetail(detail)) {
      continue;
    }
    fieldErrors[detail.field] = toFieldMessage(detail);
  }

  const codeField = FIELD_BY_CODE[error.code];
  if (codeField && !fieldErrors[codeField]) {
    fieldErrors[codeField] =
      error.code === AuthErrorCode.USERNAME_TAKEN
        ? "That username is already registered. Try another one."
        : "That email address is already registered. Try signing in instead.";
  }

  const banner =
    BANNER_BY_CODE[error.code] ??
    (rootDetail ? toFieldMessage(rootDetail) : Object.keys(fieldErrors).length ? null : GENERIC_MESSAGE);

  return { banner, fields: fieldErrors };
};

/** The banner message alone, for callers that only surface one message. */
export const getAuthErrorBanner = (error: unknown): string | null =>
  getAuthErrorCopy(error).banner;

/**
 * Rate limiting is the one case where waiting is the actual instruction, so the
 * delay the server asked for is folded into the copy.
 */
export const getRateLimitMessage = (error: unknown): string | null => {
  if (!isApiError(error) || error.code !== AuthErrorCode.TOO_MANY_REQUESTS) {
    return null;
  }

  const waitSeconds = error.retryAfter;
  if (typeof waitSeconds !== "number") {
    return "Too many attempts. Please wait a few minutes and try again.";
  }

  const waitMinutes = Math.max(1, Math.ceil(waitSeconds / 60));
  return `Too many attempts. Please try again in about ${waitMinutes} minute${
    waitMinutes === 1 ? "" : "s"
  }.`;
};

/**
 * Separates "there was no session" from "the session we stored could not be
 * verified". Only the second case means the user was signed out unexpectedly,
 * and only that case is worth explaining.
 */
export const getSessionRestoreMessage = (error: unknown): string | null => {
  if (!isApiError(error) || error.code === AuthErrorCode.TOKEN_MISSING) {
    return null;
  }

  if (error.code === AuthErrorCode.NETWORK_ERROR) {
    return "We could not check your saved session because the server was unreachable. Sign in again to continue.";
  }

  return "Your saved session is no longer valid, so we signed you out. Sign in again to continue.";
};