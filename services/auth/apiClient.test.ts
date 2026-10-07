import { ApiError, authRequest, getApiBaseUrl } from "@/services/auth/apiClient";
import { AuthErrorCode } from "@/types/AuthTypes";
import {
  createErrorResponse,
  createJsonResponse,
  createSuccessResponse,
} from "@/tests/factories/authFactories";

const fetchMock = jest.fn();

describe("auth api client", () => {
  const originalFetch = global.fetch;
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  });

  describe("base url", () => {
    it("defaults to the local API and ignores a trailing slash", () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      expect(getApiBaseUrl()).toBe("http://localhost:7000");

      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/";
      expect(getApiBaseUrl()).toBe("https://api.example.com");
    });
  });

  describe("what goes on the wire", () => {
    it("posts JSON without credentials and without an Authorization header", async () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
      fetchMock.mockResolvedValue(createSuccessResponse({ ok: true }, 201));

      await authRequest("/auth/register", {
        method: "POST",
        body: { username: " MiXeD  ", password: "abc12345" },
      });

      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe("https://api.example.com/auth/register");
      expect(init.method).toBe("POST");
      expect(init.headers["Content-Type"]).toBe("application/json; charset=utf-8");
      expect(init.headers.Authorization).toBeUndefined();

      // Credentials are off: auth is a Bearer header and the service sets no
      // cookies, so `include` would be both wrong and a CORS failure.
      expect(init.credentials).toBe("omit");

      // The body is the caller's, verbatim.
      expect(JSON.parse(init.body)).toEqual({
        username: " MiXeD  ",
        password: "abc12345",
      });
    });

    it("sends the access token as a Bearer header when one is given", async () => {
      fetchMock.mockResolvedValue(createSuccessResponse({ user: {} }));

      await authRequest("/auth/me", { token: "abc.def.ghi" });

      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers.Authorization).toBe("Bearer abc.def.ghi");
      expect(init.body).toBeUndefined();
    });
  });

  describe("response handling", () => {
    it("unwraps the data from a success envelope", async () => {
      fetchMock.mockResolvedValue(createSuccessResponse({ accessToken: "t" }));

      await expect(authRequest("/auth/refresh")).resolves.toEqual({ accessToken: "t" });
    });

    it("treats 204 as success and never parses a body", async () => {
      const text = jest.fn();
      fetchMock.mockResolvedValue({
        ok: true,
        status: 204,
        headers: { get: () => null },
        text,
      } as unknown as Response);

      await expect(authRequest("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
      expect(text).not.toHaveBeenCalled();
    });
  });

  describe("rejections", () => {
    it("branches on the error code and keeps the request id", async () => {
      fetchMock.mockResolvedValue(
        createErrorResponse(401, "invalid_credentials", "Invalid username, email or password.", [], {
          "X-Request-Id": "req-42",
        })
      );

      const error = await authRequest("/auth/login", { method: "POST", body: {} }).catch(
        (thrown: unknown) => thrown
      );

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      expect((error as ApiError).status).toBe(401);
      expect((error as ApiError).requestId).toBe("req-42");
    });

    it("reads every failing field from a single validation response", async () => {
      fetchMock.mockResolvedValue(
        createErrorResponse(400, "validation_failed", "Request validation failed.", [
          { field: "username", code: "field_too_short", message: "Too short." },
          { field: "password", code: "field_invalid", message: "Needs a digit." },
        ])
      );

      const error = (await authRequest("/auth/register", {
        method: "POST",
        body: {},
      }).catch((thrown: unknown) => thrown)) as ApiError;

      expect(error.details).toHaveLength(2);
      expect(error.details.map((detail) => detail.field)).toEqual(["username", "password"]);
    });

    it("tolerates a validation failure with no details", async () => {
      fetchMock.mockResolvedValue(
        createErrorResponse(400, "validation_failed", "Request body is not valid JSON.")
      );

      const error = (await authRequest("/auth/register", {
        method: "POST",
        body: {},
      }).catch((thrown: unknown) => thrown)) as ApiError;

      expect(error.code).toBe(AuthErrorCode.VALIDATION_FAILED);
      expect(error.details).toEqual([]);
    });

    it("falls back to the status when the code is not in the catalogue", async () => {
      fetchMock.mockResolvedValue(createErrorResponse(429, "some_new_code", "Slow down."));

      const error = (await authRequest("/auth/login", {
        method: "POST",
        body: {},
      }).catch((thrown: unknown) => thrown)) as ApiError;

      expect(error.code).toBe(AuthErrorCode.TOO_MANY_REQUESTS);
    });

    it("reads Retry-After when the request was rate limited", async () => {
      fetchMock.mockResolvedValue(
        createErrorResponse(429, "too_many_requests", "Too many requests.", [], {
          "Retry-After": "125",
        })
      );

      const error = (await authRequest("/auth/login", {
        method: "POST",
        body: {},
      }).catch((thrown: unknown) => thrown)) as ApiError;

      expect(error.retryAfter).toBe(125);
    });

    it("reports a transport failure distinctly from a rejection", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      const error = (await authRequest("/auth/me", { token: "t" }).catch(
        (thrown: unknown) => thrown
      )) as ApiError;

      // Distinguishable from a rejection, because a rejected session must clear
      // storage while an unreachable server must not.
      expect(error.code).toBe(AuthErrorCode.NETWORK_ERROR);
      expect(error.status).toBeNull();
    });

    it("rejects an ok response that is not an envelope", async () => {
      fetchMock.mockResolvedValue(createJsonResponse(200, { unexpected: true }));

      const error = (await authRequest("/auth/me", { token: "t" }).catch(
        (thrown: unknown) => thrown
      )) as ApiError;

      expect(error.code).toBe(AuthErrorCode.INTERNAL_ERROR);
    });

    it("rejects an envelope that reports failure under a 200 status", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ success: false, error: { code: "conflict", message: "No." } }),
      });

      const error = (await authRequest("/auth/refresh", { method: "POST" }).catch(
        (thrown: unknown) => thrown
      )) as ApiError;

      expect(error.code).toBe(AuthErrorCode.CONFLICT);
    });
  });
});