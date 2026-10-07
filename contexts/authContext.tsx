"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { AuthErrorCode } from "@/types/AuthTypes";
import type { AuthResult, AuthStatus, AuthUser, LoginPayload, RegisterPayload } from "@/types/AuthTypes";
import {
  clearSession,
  fetchCurrentUser,
  getAccessTokenExpiry,
  getStoredTokens,
  isApiError,
  login,
  logout,
  refreshSession,
  register,
} from "@/services/auth";
import { AUTH_STORAGE_KEY } from "@/services/auth/tokenStorage";
import { getSessionRestoreMessage } from "@/helpers/authErrors";

/** Renew a little before the access token actually lapses. */
const REFRESH_SKEW_MS = 60_000;

/** A transport blip should not end a session, but it should not retry forever. */
const REFRESH_RETRY_MS = 10_000;
const MAX_REFRESH_RETRIES = 2;

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  /** Explains an unexpected sign-out. Null when there was never a session. */
  sessionRestoreMessage: string | null;
  /**
   * When the current token pair was issued. Changes on every refresh so the
   * next refresh can be scheduled from the new expiry.
   */
  sessionAt: number;
};

const INITIAL_STATE: AuthState = {
  status: "initialising",
  user: null,
  sessionRestoreMessage: null,
  sessionAt: 0,
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  isSignedIn: boolean;
  sessionRestoreMessage: string | null;
  /** Rejects with an `ApiError`, which the caller maps to user-facing copy. */
  signIn: (payload: LoginPayload) => Promise<AuthResult>;
  signUp: (payload: RegisterPayload) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const signOutLocally = useCallback((message: string | null = null) => {
    clearRefreshTimer();
    retryCountRef.current = 0;
    clearSession();
    setState({ ...INITIAL_STATE, status: "unauthenticated", sessionRestoreMessage: message });
  }, [clearRefreshTimer]);

  const adoptSession = useCallback((user: AuthUser) => {
    retryCountRef.current = 0;
    setState({
      status: "authenticated",
      user,
      sessionRestoreMessage: null,
      sessionAt: Date.now(),
    });
  }, []);

  const refreshNow = useCallback(async () => {
    try {
      const result = await refreshSession();
      adoptSession(result.user);
    } catch (error) {
      // The contract ends the local session on any refresh failure. The single
      // exception is a transport failure with retries left, where the session
      // may still be good and the user is not online.
      if (isApiError(error) && error.code === AuthErrorCode.NETWORK_ERROR && retryCountRef.current < MAX_REFRESH_RETRIES) {
        retryCountRef.current += 1;
        refreshTimerRef.current = setTimeout(() => {
          void refreshNow();
        }, REFRESH_RETRY_MS);
        return;
      }

      signOutLocally();
    }
  }, [adoptSession, signOutLocally]);

  // Restore a session stored by a previous visit. Nothing is sent when there is
  // nothing stored, so an anonymous visitor makes no request at all.
  useEffect(() => {
    if (!getStoredTokens()) {
      setState({ ...INITIAL_STATE, status: "unauthenticated" });
      return;
    }

    let cancelled = false;

    const restore = async () => {
      try {
        const user = await fetchCurrentUser();
        if (!cancelled) {
          adoptSession(user);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        // An expired access token is not the end of the session: the refresh
        // token behind it may still be good.
        if (isApiError(error) && error.code === AuthErrorCode.TOKEN_EXPIRED) {
          await refreshNow();
          return;
        }

        signOutLocally(getSessionRestoreMessage(error));
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [adoptSession, refreshNow, signOutLocally]);

  // Keep tabs in step: signing out in one tab signs out the others.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_STORAGE_KEY) {
        return;
      }

      if (!getStoredTokens()) {
        signOutLocally();
        return;
      }

      void fetchCurrentUser()
        .then(adoptSession)
        .catch(() => signOutLocally());
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [adoptSession, signOutLocally]);

  // Schedule the next refresh from the current token pair's own expiry.
  useEffect(() => {
    if (state.status !== "authenticated") {
      clearRefreshTimer();
      return;
    }

    const expiresAt = getAccessTokenExpiry();
    if (expiresAt === null) {
      return;
    }

    refreshTimerRef.current = setTimeout(() => {
      void refreshNow();
    }, Math.max(0, expiresAt - Date.now() - REFRESH_SKEW_MS));

    return clearRefreshTimer;
  }, [state.status, state.sessionAt, clearRefreshTimer, refreshNow]);

  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  const signIn = useCallback(async (payload: LoginPayload) => {
    const result = await login(payload);
    adoptSession(result.user);
    return result;
  }, [adoptSession]);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    const result = await register(payload);
    adoptSession(result.user);
    return result;
  }, [adoptSession]);

  const signOut = useCallback(async () => {
    signOutLocally();
    await logout();
  }, [signOutLocally]);

  const contextValue = useMemo(
    () => ({
      status: state.status,
      user: state.user,
      isSignedIn: state.status === "authenticated",
      sessionRestoreMessage: state.sessionRestoreMessage,
      signIn,
      signUp,
      signOut,
    }),
    [state.status, state.user, state.sessionRestoreMessage, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return context;
};