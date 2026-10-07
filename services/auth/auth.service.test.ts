import {
  fetchCurrentUser,
  getStoredTokens,
  login,
  logout,
  refreshSession,
  register,
} from "@/services/auth/auth.service";
import { AUTH_STORAGE_KEY } from "@/services/auth/tokenStorage";
import { AuthErrorCode, Gender } from "@/types/AuthTypes";
import {
  createAuthResult,
  createAuthUser,
  createDeferred,
  createErrorResponse,
  createJsonResponse,
  createSuccessResponse,
} from "@/tests/factories/authFactories";

const fetchMock = jest.fn();

const storeSession = (accessToken: string, refreshToken: string, expiresIn = 900) => {
  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ accessToken, refreshToken, expiresIn, expiresAt: Date.now() + expiresIn * 1000 })
  );
};

const readStoredSession = () => {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
};

describe("auth service", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    window.localStorage.clear();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("register", () => {
    it("stores the issued token pair", async () => {
      fetchMock.mockResolvedValue(createSuccessResponse(createAuthResult(), 201));

      await register({
        username: " MiXeD  ",
        email: " Probe1@Example.com ",
        firstName: "Probe",
        lastName: "One",
        country: "IN",
        gender: Gender.OTHER,
        password: "abc12345",
      });

      const stored = readStoredSession();
      expect(stored?.accessToken).toBe("access-token-1");
      expect(stored?.refreshToken).toBe("refresh-token-1");
    });

    it("sends the caller's values verbatim, without normalising them", async () => {
      fetchMock.mockResolvedValue(createSuccessResponse(createAuthResult(), 201));

      await register({
        username: " MiXeD  ",
        email: " Probe1@Example.com ",
        firstName: "Probe",
        lastName: "One",
        country: "IN",
        gender: Gender.OTHER,
        password: "abc12345",
      });

      const [, init] = fetchMock.mock.calls[0];

      // The server trims and lowercases. Doing it here would make a transport
      // problem indistinguishable from a normalisation one.
      expect(JSON.parse(init.body)).toEqual({
        username: " MiXeD  ",
        email: " Probe1@Example.com ",
        firstName: "Probe",
        lastName: "One",
        country: "IN",
        gender: "other",
        password: "abc12345",
      });
    });
  });

  describe("login", () => {
    it("sends the identifier in a single field and stores the result", async () => {
      fetchMock.mockResolvedValue(createSuccessResponse(createAuthResult()));

      await login({ identifier: " Probe1@Example.com ", password: "abc12345" });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/auth/login");
      expect(JSON.parse(init.body)).toEqual({
        identifier: " Probe1@Example.com ",
        password: "abc12345",
      });
      expect(getStoredTokens()?.accessToken).toBe("access-token-1");
    });
  });

  describe("refresh", () => {
    it("rotates the stored refresh token on every success", async () => {
      storeSession("access-1", "refresh-1");

      fetchMock
        .mockResolvedValueOnce(
          createSuccessResponse(createAuthResult({ refreshToken: "refresh-2", accessToken: "access-2" }))
        )
        .mockResolvedValueOnce(
          createSuccessResponse(createAuthResult({ refreshToken: "refresh-3", accessToken: "access-3" }))
        );

      await refreshSession();
      expect(readStoredSession()?.refreshToken).toBe("refresh-2");

      await refreshSession();

      // The second call must present the token the first one issued, never the
      // one that was consumed.
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
        refreshToken: "refresh-2",
      });
      expect(readStoredSession()?.refreshToken).toBe("refresh-3");
    });

    it("keeps only one refresh in flight, because concurrent ones look like reuse", async () => {
      storeSession("access-1", "refresh-1");

      const deferred = createDeferred<ReturnType<typeof createSuccessResponse>>();
      fetchMock.mockReturnValue(deferred.promise);

      const first = refreshSession();
      const second = refreshSession();
      const third = refreshSession();

      deferred.resolve(createSuccessResponse(createAuthResult()));

      const results = await Promise.all([first, second, third]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
    });

    it("clears the session when the refresh token cannot be exchanged", async () => {
      storeSession("access-1", "refresh-1");
      fetchMock.mockResolvedValue(
        createErrorResponse(
          401,
          "session_revoked",
          "Refresh token reuse detected. All sessions have been revoked; please sign in again."
        )
      );

      const error = (await refreshSession().catch((thrown: unknown) => thrown)) as {
        code: string;
      };

      expect(error.code).toBe(AuthErrorCode.SESSION_REVOKED);
      expect(readStoredSession()).toBeNull();
    });

    it("keeps the session when the refresh could not be sent at all", async () => {
      storeSession("access-1", "refresh-1");
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(refreshSession()).rejects.toMatchObject({ code: AuthErrorCode.NETWORK_ERROR });
      // The token may still be good, so an unreachable server must not sign
      // anyone out.
      expect(readStoredSession()?.refreshToken).toBe("refresh-1");
    });

    it("fails without a request when there is nothing stored", async () => {
      await expect(refreshSession()).rejects.toMatchObject({ code: AuthErrorCode.TOKEN_MISSING });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("revokes the session and clears storage", async () => {
      storeSession("access-1", "refresh-1");
      fetchMock.mockResolvedValue(createJsonResponse(204));

      await logout();

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/auth/logout");
      expect(init.headers.Authorization).toBe("Bearer access-1");
      expect(readStoredSession()).toBeNull();
    });

    it("clears storage even when the request fails, because logout is idempotent", async () => {
      storeSession("access-1", "refresh-1");
      fetchMock.mockResolvedValue(createErrorResponse(401, "token_invalid", "Nope."));

      await expect(logout()).resolves.toBeUndefined();
      expect(readStoredSession()).toBeNull();
    });
  });

  describe("me", () => {
    it("returns the nested user", async () => {
      storeSession("access-1", "refresh-1");
      const user = createAuthUser();
      fetchMock.mockResolvedValue(createSuccessResponse({ user }));

      await expect(fetchCurrentUser()).resolves.toEqual(user);
    });

    it("keeps the session when only the access token has expired", async () => {
      storeSession("access-1", "refresh-1");
      fetchMock.mockResolvedValue(createErrorResponse(401, "token_expired", "Expired."));

      await expect(fetchCurrentUser()).rejects.toMatchObject({ code: AuthErrorCode.TOKEN_EXPIRED });
      // Recoverable: the refresh token behind it may still be good.
      expect(readStoredSession()?.refreshToken).toBe("refresh-1");
    });

    it("clears the session when it has been revoked", async () => {
      storeSession("access-1", "refresh-1");
      fetchMock.mockResolvedValue(createErrorResponse(401, "session_revoked", "Revoked."));

      await expect(fetchCurrentUser()).rejects.toMatchObject({ code: AuthErrorCode.SESSION_REVOKED });
      expect(readStoredSession()).toBeNull();
    });

    it("keeps the session when the server could not be reached", async () => {
      storeSession("access-1", "refresh-1");
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(fetchCurrentUser()).rejects.toMatchObject({ code: AuthErrorCode.NETWORK_ERROR });
      expect(readStoredSession()?.accessToken).toBe("access-1");
    });
  });
});