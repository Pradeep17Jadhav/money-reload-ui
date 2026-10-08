import type { AuthTokens } from "@/types/AuthTypes";

export const AUTH_STORAGE_KEY = "moneyreload.auth";

const STORAGE_KEY = AUTH_STORAGE_KEY;

type StoredSession = AuthTokens & {
  /** Epoch milliseconds at which the access token stops being accepted. */
  expiresAt: number;
};

/**
 * Tokens are a client-side concern held in browser storage: the API is
 * Bearer-only and sets no cookies. Every access is guarded so the module is
 * safe to import from a server component.
 */
const isBrowser = (): boolean => typeof window !== "undefined";

export const getStoredSession = (): StoredSession | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as StoredSession).accessToken !== "string" ||
      typeof (parsed as StoredSession).refreshToken !== "string"
    ) {
      return null;
    }

    return parsed as StoredSession;
  } catch {
    return null;
  }
};

export const saveStoredSession = (session: StoredSession): void => {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode, quota). An in-memory session
    // still works for this tab, so this is deliberately non-fatal.
  }
};

export const clearStoredSession = (): void => {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See saveStoredSession.
  }
};