import { AuthErrorCode } from "@/types/AuthTypes";
import type { AuthResult, AuthTokens, AuthUser, LoginPayload, RegisterPayload, UpdateProfilePayload } from "@/types/AuthTypes";
import { ApiError, authRequest, isApiError } from "@/services/apiClient";
import { clearStoredSession, getStoredSession, saveStoredSession } from "./tokenStorage";

/**
 * Persists a fresh token pair. Called on every successful register, login and
 * refresh so that a rotated refresh token is stored the instant it arrives and
 * the previous one is never presented again.
 */
const persistTokens = ({ accessToken, refreshToken, expiresIn }: AuthTokens): void => {
  saveStoredSession({
    accessToken,
    refreshToken,
    expiresIn,
    expiresAt: Date.now() + expiresIn * 1000,
  });
};

export const register = async (payload: RegisterPayload): Promise<AuthResult> => {
  try {
    // Fields are sent exactly as typed. The server owns trimming and lowercasing,
    // and normalising here would make a transport problem indistinguishable from
    // a normalisation one.
    const result = await authRequest<AuthResult>("/auth/register", {
      method: "POST",
      body: payload,
    });

    persistTokens(result);
    return result;
  } catch (error) {
    throw toApiError(error);
  }
};

export const login = async (payload: LoginPayload): Promise<AuthResult> => {
  try {
    const result = await authRequest<AuthResult>("/auth/login", {
      method: "POST",
      body: payload,
    });

    persistTokens(result);
    return result;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Only one refresh may be in flight at any moment. Concurrent refreshes present
 * the same token twice, which the server treats as reuse and answers by revoking
 * every session the user holds.
 */
let inFlightRefresh: Promise<AuthResult> | null = null;

export const refreshSession = (): Promise<AuthResult> => {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const request = (async (): Promise<AuthResult> => {
    const stored = getStoredSession();
    if (!stored) {
      throw new ApiError({
        code: AuthErrorCode.TOKEN_MISSING,
        message: "There is no stored session to refresh.",
      });
    }

    try {
      const result = await authRequest<AuthResult>("/auth/refresh", {
        method: "POST",
        body: { refreshToken: stored.refreshToken },
      });

      // Refresh rotates: store the new pair, never the consumed one.
      persistTokens(result);
      return result;
    } catch (error) {
      const apiError = toApiError(error);

      // A refresh token that cannot be exchanged is not recoverable. A transport
      // failure is the one case where the token may still be good.
      if (apiError.code !== AuthErrorCode.NETWORK_ERROR) {
        clearStoredSession();
      }

      throw apiError;
    }
  })();

  inFlightRefresh = request;

  // Released once settled, so the next genuine refresh can start.
  return request.finally(() => {
    inFlightRefresh = null;
  });
};

/**
 * Revokes the server session, then clears local state unconditionally. The
 * endpoint is idempotent, so 204 is the only success signal and every error is
 * swallowed: signing out must always leave the browser signed out.
 */
export const logout = async (): Promise<void> => {
  const stored = getStoredSession();

  try {
    if (stored) {
      await authRequest<void>("/auth/logout", {
        method: "POST",
        token: stored.accessToken,
      });
    }
  } catch {
    // Deliberately ignored, including 401 session_revoked.
  } finally {
    clearStoredSession();
  }
};

/**
 * Rejections after which there is nothing left to recover. `token_expired` is
 * deliberately absent: the access token is the short-lived one and the refresh
 * token behind it may still be good.
 */
const UNRECOVERABLE_CODES = new Set<AuthErrorCode>([
  AuthErrorCode.TOKEN_MISSING,
  AuthErrorCode.TOKEN_INVALID,
  AuthErrorCode.SESSION_REVOKED,
  AuthErrorCode.USER_NOT_FOUND,
  AuthErrorCode.NOT_FOUND,
]);

/**
 * Confirms the stored access token is still good and rehydrates the user.
 *
 * A rejection that leaves nothing to recover clears storage. `token_expired`
 * does not, because the session can be renewed with the refresh token, and a
 * transport failure does not, because the session may still be valid and the
 * user must not be signed out for being offline.
 */
export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const stored = getStoredSession();
  if (!stored) {
    throw new ApiError({
      code: AuthErrorCode.TOKEN_MISSING,
      message: "There is no stored session.",
    });
  }

  try {
    // `/auth/me` nests the user one level deeper than the other endpoints.
    const { user } = await authRequest<{ user: AuthUser }>("/auth/me", {
      token: stored.accessToken,
    });

    return user;
  } catch (error) {
    const apiError = toApiError(error);

    if (UNRECOVERABLE_CODES.has(apiError.code)) {
      clearStoredSession();
    }

    throw apiError;
  }
};

/**
 * Partial profile update. Returns the full updated user, and `username`, `email`
 * and `id` are deliberately absent from the payload type because the endpoint
 * rejects them.
 */
export const updateCurrentUser = async (
  payload: UpdateProfilePayload
): Promise<AuthUser> => {
  const { user } = await authRequest<{ user: AuthUser }>("/auth/me", {
    method: "PATCH",
    body: payload,
    token: getStoredTokens()?.accessToken,
  });

  return user;
};

/** Returns 204 with an empty body, so there is nothing to return. */
export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  await authRequest<void>("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
    token: getStoredTokens()?.accessToken,
  });
};

export const getStoredTokens = (): AuthTokens | null => {
  const stored = getStoredSession();
  if (!stored) {
    return null;
  }

  return {
    accessToken: stored.accessToken,
    refreshToken: stored.refreshToken,
    expiresIn: stored.expiresIn,
  };
};

/**
 * The epoch at which the stored access token expires, used to schedule the
 * refresh. Null when there is nothing stored.
 */
export const getAccessTokenExpiry = (): number | null => getStoredSession()?.expiresAt ?? null;

export const clearSession = (): void => {
  clearStoredSession();
};

const toApiError = (error: unknown): ApiError => {
  if (isApiError(error)) {
    return error;
  }

  return new ApiError({
    code: AuthErrorCode.NETWORK_ERROR,
    message: error instanceof Error ? error.message : "The request could not be completed.",
  });
};

export { ApiError, isApiError };