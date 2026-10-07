import { AuthErrorCode } from "@/types/AuthTypes";
import type { AuthErrorDetail } from "@/types/AuthTypes";
import type { ApiEnvelope, AuthRequestOptions } from "./apiClient.types";

const DEFAULT_API_BASE_URL = "http://localhost:7000";

/**
 * The single place the API's location is resolved. Everything else in the app
 * goes through the exported functions in this folder.
 *
 * `NEXT_PUBLIC_` is required because auth is a Bearer-token, client-side
 * concern and the token never passes through a server session.
 */
export const getApiBaseUrl = (): string => {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const baseUrl = configured?.length ? configured : DEFAULT_API_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
};

/**
 * A normalised rejection from the API, or from the transport itself.
 *
 * `code` is the contract; `message` is for logs only and is never rendered
 * directly. Consumers map codes to user-facing copy via
 * `helpers/authErrors.ts`.
 */
export class ApiError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number | null;
  readonly details: AuthErrorDetail[];
  readonly requestId: string | null;
  /** `Retry-After` in seconds, present on 429. */
  readonly retryAfter: number | null;

  constructor({
    code,
    message,
    status = null,
    details = [],
    requestId = null,
    retryAfter = null,
  }: {
    code: AuthErrorCode;
    message: string;
    status?: number | null;
    details?: AuthErrorDetail[];
    requestId?: string | null;
    retryAfter?: number | null;
  }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
  }
}

export const isApiError = (value: unknown): value is ApiError =>
  value instanceof ApiError;

/**
 * Fallback when a rejection arrives without a usable `error.code`, so a
 * contract change degrades to a sane message instead of leaking a raw string.
 */
const CODE_BY_STATUS: Record<number, AuthErrorCode> = {
  400: AuthErrorCode.VALIDATION_FAILED,
  401: AuthErrorCode.TOKEN_INVALID,
  404: AuthErrorCode.NOT_FOUND,
  409: AuthErrorCode.CONFLICT,
  413: AuthErrorCode.PAYLOAD_TOO_LARGE,
  429: AuthErrorCode.TOO_MANY_REQUESTS,
  500: AuthErrorCode.INTERNAL_ERROR,
  503: AuthErrorCode.DATABASE_UNAVAILABLE,
};

const toAuthErrorCode = (code: string | undefined, status: number): AuthErrorCode => {
  if (code && Object.values(AuthErrorCode).includes(code as AuthErrorCode)) {
    return code as AuthErrorCode;
  }
  return CODE_BY_STATUS[status] ?? AuthErrorCode.INTERNAL_ERROR;
};

const toAuthErrorDetails = (value: unknown): AuthErrorDetail[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): AuthErrorDetail[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const { field, code, message } = entry as Record<string, unknown>;
    if (typeof field !== "string") {
      return [];
    }

    return [
      {
        field,
        code: typeof code === "string" ? code : AuthErrorCode.VALIDATION_FAILED,
        message: typeof message === "string" ? message : "",
      },
    ];
  });
};

const parseRetryAfter = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
};

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const isApiEnvelope = (value: unknown): value is ApiEnvelope<unknown> => {
  if (!value || typeof value !== "object") {
    return false;
  }
  return typeof (value as ApiEnvelope<unknown>).success === "boolean";
};

const buildRejection = (
  response: Response,
  payload: unknown,
  requestId: string | null
): ApiError => {
  const envelope = isApiEnvelope(payload) && payload.success === false ? payload : null;
  const status = response.status;
  const code = toAuthErrorCode(envelope?.error?.code, status);
  const message =
    typeof envelope?.error?.message === "string" && envelope.error.message.length
      ? envelope.error.message
      : `Request failed with status ${status}.`;

  return new ApiError({
    code,
    message,
    status,
    details: toAuthErrorDetails(envelope?.error?.details),
    requestId,
    retryAfter: parseRetryAfter(response.headers.get("Retry-After")),
  });
};

/**
 * Performs one request against the auth API and unwraps the envelope.
 *
 * Credentials stay off. Auth is a Bearer header and the service sets no
 * cookies, so `credentials: "include"` would be both wrong and a CORS failure.
 */
export const authRequest = async <TData>(
  path: string,
  { method = "GET", body, token }: AuthRequestOptions = {}
): Promise<TData> => {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json; charset=utf-8";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      credentials: "omit",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    // The request may never have reached the server. A transport failure is not
    // a rejection of the session, so callers must not clear stored state on it.
    throw new ApiError({
      code: AuthErrorCode.NETWORK_ERROR,
      message: "The request could not be completed.",
    });
  }

  const requestId = response.headers.get("X-Request-Id");

  // 204 carries a completely empty body. A 204 with a body is a bug in the
  // caller, not something to parse.
  if (response.status === 204) {
    return undefined as TData;
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw buildRejection(response, payload, requestId);
  }

  if (!isApiEnvelope(payload)) {
    throw new ApiError({
      code: AuthErrorCode.INTERNAL_ERROR,
      message: "The server returned an unexpected response.",
      status: response.status,
      requestId,
    });
  }

  if (payload.success === false) {
    throw buildRejection(response, payload, requestId);
  }

  return payload.data as TData;
};