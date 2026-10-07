export enum Gender {
  FEMALE = "female",
  MALE = "male",
  OTHER = "other",
}

export enum AuthErrorCode {
  VALIDATION_FAILED = "validation_failed",
  INVALID_CREDENTIALS = "invalid_credentials",
  TOKEN_MISSING = "token_missing",
  TOKEN_INVALID = "token_invalid",
  TOKEN_EXPIRED = "token_expired",
  SESSION_REVOKED = "session_revoked",
  NOT_FOUND = "not_found",
  USER_NOT_FOUND = "user_not_found",
  USERNAME_TAKEN = "username_taken",
  EMAIL_TAKEN = "email_taken",
  CONFLICT = "conflict",
  PAYLOAD_TOO_LARGE = "payload_too_large",
  TOO_MANY_REQUESTS = "too_many_requests",
  INTERNAL_ERROR = "internal_error",
  DATABASE_ERROR = "database_error",
  DATABASE_UNAVAILABLE = "database_unavailable",
  /**
   * Not part of the API catalogue. Raised when the request never produced a
   * response (offline, DNS failure, CORS rejection, abort). Distinguished from
   * a server rejection so that a transport failure does not clear a session
   * that may still be perfectly valid.
   */
  NETWORK_ERROR = "network_error",
}

export enum AuthFieldErrorCode {
  FIELD_REQUIRED = "field_required",
  FIELD_TOO_SHORT = "field_too_short",
  FIELD_TOO_LONG = "field_too_long",
  FIELD_INVALID_FORMAT = "field_invalid_format",
  FIELD_INVALID_TYPE = "field_invalid_type",
  FIELD_INVALID = "field_invalid",
}

/**
 * The sentinel the API uses for a problem with the request object as a whole
 * rather than with one property.
 */
export const ROOT_FIELD = "_root";

export type AuthUser = {
  /** 24-character hex MongoDB ObjectId. Always a string, never a number. */
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Uppercase ISO 3166-1 alpha-2. */
  country: string;
  gender: Gender;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthResult = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. Server configuration; never hardcode. */
  expiresIn: number;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type AuthErrorDetail = {
  field: string;
  code: AuthFieldErrorCode | string;
  message: string;
};

export type LoginPayload = {
  /** A username or an email, in a single field. Sent verbatim, never normalised. */
  identifier: string;
  password: string;
};

export type RegisterPayload = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  gender: Gender;
  password: string;
};

export type AuthStatus = "initialising" | "authenticated" | "unauthenticated";