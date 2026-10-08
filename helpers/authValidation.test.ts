import { COUNTRIES, isCountryCode } from "@/helpers/countries";
import {
  REGISTER_INITIAL_VALUES,
  getUnmetPasswordRules,
  getUtf8ByteLength,
  hasErrors,
  validateIdentifier,
  validateLoginForm,
  validatePassword,
  validateRegisterForm,
} from "@/helpers/authValidation";
import { Gender } from "@/types/AuthTypes";

const validRegistration = {
  ...REGISTER_INITIAL_VALUES,
  firstName: "Probe",
  lastName: "One",
  username: "probe1",
  email: "probe1@example.com",
  country: "IN",
  gender: Gender.OTHER,
  password: "abc12345",
  confirmPassword: "abc12345",
  acceptedTerms: true,
};

describe("countries", () => {
  it("stores alpha-2 codes upper case", () => {
    expect(COUNTRIES.every((country) => country.code === country.code.toUpperCase())).toBe(true);
    expect(COUNTRIES.every((country) => country.code.length === 2)).toBe(true);
  });

  it("has no duplicate codes", () => {
    expect(new Set(COUNTRIES.map((country) => country.code)).size).toBe(COUNTRIES.length);
  });

  it("recognises codes regardless of case", () => {
    expect(isCountryCode("in")).toBe(true);
    expect(isCountryCode("ZZ")).toBe(false);
  });
});

describe("validateIdentifier", () => {
  it("accepts either a username or an email without branching in the component", () => {
    expect(validateIdentifier("probe1")).toBeUndefined();
    expect(validateIdentifier("Probe.1_x")).toBeUndefined();
    expect(validateIdentifier("probe1@example.com")).toBeUndefined();
  });

  it("rejects a malformed email", () => {
    expect(validateIdentifier("probe1@example")).toMatch(/valid email/i);
  });

  it("rejects a malformed username", () => {
    expect(validateIdentifier("ab")).toMatch(/between 3 and 30/i);
    expect(validateIdentifier("has spaces")).toMatch(/letters, numbers/i);
    expect(validateIdentifier("a".repeat(31))).toMatch(/between 3 and 30/i);
  });

  it("asks for a value when there is none", () => {
    expect(validateIdentifier("   ")).toMatch(/username or email/i);
  });
});

describe("validateLoginForm", () => {
  it("requires only a non-empty password, because login does not re-check complexity", () => {
    expect(validateLoginForm({ identifier: "probe1", password: "short" })).toEqual({
      identifier: undefined,
      password: undefined,
    });
  });

  it("is invalid until both fields are filled", () => {
    expect(hasErrors(validateLoginForm({ identifier: "", password: "" }))).toBe(true);
    expect(hasErrors(validateLoginForm({ identifier: "probe1", password: "" }))).toBe(true);
  });
});

describe("validatePassword", () => {
  it("mirrors the server's rules", () => {
    expect(validatePassword("abc12345")).toBeUndefined();
    expect(validatePassword("abcdefgh")).toMatch(/one letter and one number/i);
    expect(validatePassword("12345678")).toMatch(/one letter and one number/i);
    expect(validatePassword("abc1234")).toMatch(/at least 8/i);
  });

  it("measures length in UTF-8 bytes, not characters", () => {
    // 40 characters, but well over 72 bytes once encoded.
    const multiByte = "é".repeat(40);
    expect(multiByte.length).toBe(40);
    expect(getUtf8ByteLength(multiByte)).toBe(80);
    expect(validatePassword(multiByte)).toMatch(/too long/i);
  });

  it("reports every unmet rule for the hint", () => {
    expect(getUnmetPasswordRules("abc")).toEqual(["at least 8 characters", "one number"]);
    expect(getUnmetPasswordRules("abc12345")).toEqual([]);
  });
});

describe("validateRegisterForm", () => {
  it("accepts a complete form", () => {
    expect(hasErrors(validateRegisterForm(validRegistration))).toBe(false);
  });

  it("requires consent", () => {
    const errors = validateRegisterForm({ ...validRegistration, acceptedTerms: false });
    expect(errors.acceptedTerms).toMatch(/accept the terms/i);
  });

  it("reports a confirm mismatch", () => {
    const errors = validateRegisterForm({ ...validRegistration, confirmPassword: "abc12346" });
    expect(errors.confirmPassword).toMatch(/do not match/i);
  });

  it("reports every problem at once, as the server does", () => {
    const errors = validateRegisterForm({
      ...REGISTER_INITIAL_VALUES,
      firstName: "",
      lastName: "",
      username: "a",
      email: "not-an-email",
      country: "ZZ",
      gender: "",
      password: "abc",
      confirmPassword: "",
      acceptedTerms: false,
    });

    expect(Object.keys(errors)).toHaveLength(9);
  });
});