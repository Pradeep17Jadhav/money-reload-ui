import { ApiError } from "@/services/auth";
import { Gender } from "@/types/AuthTypes";
import type { AuthErrorDetail, AuthResult, AuthUser } from "@/types/AuthTypes";

/**
 * A minimal `Response` stand-in. Deliberately hand-rolled rather than using the
 * real `Response`, so the assertions are about what the client sent and how it
 * reads a payload, not about the runtime's fetch implementation.
 */
export const createJsonResponse = (
  status: number,
  body?: unknown,
  headers: Record<string, string> = {}
): Response => {
  const headerEntries = Object.entries(headers).map(([key, value]) => [
    key.toLowerCase(),
    value,
  ]);

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        headerEntries.find(([key]) => key === name.toLowerCase())?.[1] ?? null,
    },
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as unknown as Response;
};

export const createSuccessResponse = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response => createJsonResponse(status, { success: true, data }, headers);

export const createErrorResponse = (
  status: number,
  code: string,
  message: string,
  details?: AuthErrorDetail[],
  headers: Record<string, string> = {}
): Response => {
  const error: { code: string; message: string; details?: AuthErrorDetail[] } = {
    code,
    message,
  };

  // `details` is present only when non-empty, exactly as the contract states.
  if (details?.length) {
    error.details = details;
  }

  return createJsonResponse(status, { success: false, error }, headers);
};

export const createAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: "6ac5ff3d311ac3f725d43a6d",
  username: "probe1",
  email: "probe1@example.com",
  firstName: "Probe",
  lastName: "One",
  country: "IN",
  gender: Gender.OTHER,
  lastLoginAt: "2026-10-07T08:13:49.103Z",
  createdAt: "2026-10-07T08:13:49.110Z",
  updatedAt: "2026-10-07T08:13:49.110Z",
  ...overrides,
});

export const createAuthResult = (overrides: Partial<AuthResult> = {}): AuthResult => ({
  user: createAuthUser(),
  accessToken: "access-token-1",
  refreshToken: "refresh-token-1",
  expiresIn: 900,
  ...overrides,
});

export const createApiError = (
  code: string,
  overrides: Partial<{
    status: number;
    message: string;
    details: AuthErrorDetail[];
    requestId: string;
    retryAfter: number;
  }> = {}
): ApiError =>
  new ApiError({
    code: code as ApiError["code"],
    message: overrides.message ?? "server message",
    status: overrides.status ?? 400,
    details: overrides.details ?? [],
    requestId: overrides.requestId ?? "req-1",
    retryAfter: overrides.retryAfter ?? null,
  });

/** A promise plus its resolver, for holding an in-flight request open. */
export const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};