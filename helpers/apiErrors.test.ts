import {
  INVALID_CREDENTIALS_MESSAGE,
  getAuthErrorBanner,
  getAuthErrorCopy,
  getRateLimitMessage,
  getSessionRestoreMessage,
} from "@/helpers/apiErrors";
import { AuthErrorCode } from "@/types/AuthTypes";
import { createApiError } from "@/tests/factories/authFactories";

describe("auth error copy", () => {
  it("gives one message for every way a sign-in can fail", () => {
    // The API answers an unknown username, an unknown email and a wrong
    // password with the same code. The three cases below stand for the three
    // messages a server might attach, which must not leak through.
    const wrongPassword = createApiError(AuthErrorCode.INVALID_CREDENTIALS, {
      message: "No user matches probe1.",
    });
    const unknownUsername = createApiError(AuthErrorCode.INVALID_CREDENTIALS, {
      message: "Password is incorrect.",
    });
    const unknownEmail = createApiError(AuthErrorCode.INVALID_CREDENTIALS, {
      message: "Invalid username, email or password.",
    });

    const messages = [wrongPassword, unknownUsername, unknownEmail].map(getAuthErrorBanner);

    expect(messages[0]).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(new Set(messages).size).toBe(1);
  });

  it("attaches a taken username to the username field", () => {
    const copy = getAuthErrorCopy(createApiError(AuthErrorCode.USERNAME_TAKEN));

    expect(copy.banner).toBeNull();
    expect(copy.fields.username).toMatch(/already registered/i);
    expect(copy.fields.email).toBeUndefined();
  });

  it("attaches a taken email to the email field", () => {
    const copy = getAuthErrorCopy(createApiError(AuthErrorCode.EMAIL_TAKEN));

    expect(copy.banner).toBeNull();
    expect(copy.fields.email).toMatch(/already registered/i);
  });

  it("shows every field the server reported on the matching inputs", () => {
    const copy = getAuthErrorCopy(
      createApiError(AuthErrorCode.VALIDATION_FAILED, {
        details: [
          { field: "username", code: "field_too_short", message: "Username is too short." },
          { field: "email", code: "field_invalid_format", message: "Email is not valid." },
        ],
      })
    );

    expect(copy.banner).toBeNull();
    expect(copy.fields).toEqual({
      username: "Username is too short.",
      email: "Email is not valid.",
    });
  });

  it("keeps a whole-request problem on the banner and off the fields", () => {
    const copy = getAuthErrorCopy(
      createApiError(AuthErrorCode.VALIDATION_FAILED, {
        details: [{ field: "_root", code: "field_invalid", message: "Request body is not valid JSON." }],
      })
    );

    expect(copy.fields).toEqual({});
    expect(copy.banner).not.toBeNull();
  });

  it("still produces a banner when a validation failure carries no details", () => {
    expect(getAuthErrorBanner(createApiError(AuthErrorCode.VALIDATION_FAILED))).not.toBeNull();
  });

  it("explains a transport failure without claiming the session is gone", () => {
    expect(getAuthErrorBanner(createApiError(AuthErrorCode.NETWORK_ERROR))).toMatch(/could not reach/i);
  });

  it("never lets an error code reach the user", () => {
    for (const code of Object.values(AuthErrorCode)) {
      const copy = getAuthErrorCopy(createApiError(code));

      for (const message of [copy.banner, ...Object.values(copy.fields)]) {
        // Word boundaries, so ordinary prose that happens to contain a code as
        // a substring is not mistaken for a leak.
        expect(new RegExp(`\\b${code}\\b`).test(message ?? "")).toBe(false);
      }
    }
  });

  it("never renders the server's own message", () => {
    const copy = getAuthErrorCopy(
      createApiError(AuthErrorCode.INTERNAL_ERROR, {
        message: "MongoServerError: E11000 duplicate key at /srv/app/users.js:412",
      })
    );

    expect(copy.banner).not.toMatch(/mongo|e11000|users\.js/i);
  });

  it("falls back to a safe message for something that is not an ApiError", () => {
    expect(getAuthErrorBanner(new Error("boom"))).not.toBeNull();
  });

  describe("rate limiting", () => {
    it("folds the requested delay into the message", () => {
      expect(getRateLimitMessage(createApiError(AuthErrorCode.TOO_MANY_REQUESTS, { retryAfter: 125 }))).toMatch(
        /about 3 minutes/i
      );
    });

    it("still says something useful when no delay was supplied", () => {
      expect(getRateLimitMessage(createApiError(AuthErrorCode.TOO_MANY_REQUESTS))).toMatch(/wait/i);
    });

    it("stays out of the way for other codes", () => {
      expect(getRateLimitMessage(createApiError(AuthErrorCode.INVALID_CREDENTIALS))).toBeNull();
    });
  });

  describe("session restore", () => {
    it("says nothing when there was never a session", () => {
      expect(getSessionRestoreMessage(createApiError(AuthErrorCode.TOKEN_MISSING))).toBeNull();
    });

    it("distinguishes an unverifiable session from a rejected one", () => {
      const unreachable = getSessionRestoreMessage(createApiError(AuthErrorCode.NETWORK_ERROR));
      const rejected = getSessionRestoreMessage(createApiError(AuthErrorCode.SESSION_REVOKED));

      expect(unreachable).toMatch(/unreachable/i);
      expect(rejected).toMatch(/signed you out/i);
      expect(unreachable).not.toBe(rejected);
    });
  });
});