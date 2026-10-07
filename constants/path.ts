export const BLOG_PATH = "/blog";
export const ABOUT_US_PATH = "/about-us";
export const PRIVACY_POLICY_PATH = "/privacy-policy";
export const TERMS_AND_CONDITIONS_PATH = "/terms-and-conditions";
export const LEGAL_PATH = "/legal-and-regulatory";
export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";

export enum PATHS {
  HOME_PAGE = "/",
  BLOG = "/blog",
  ABOUT_US = "/about-us",
  PRIVACY_POLICY = "/privacy-policy",
  TERMS_AND_CONDITIONS = "/terms-and-conditions",
  LEGAL = "/legal-and-regulatory",
  LOGIN = "/login",
  REGISTER = "/register",
  PROFILE = "/profile",
  LOANS = "/loans",
  INCOME = "/income",
  EXPENSES = "/expenses",
  GOALS = "/goals",
}

/**
 * Routes that require a session. Kept as data so the navbar and the guard can
 * agree on exactly which routes are private.
 */
export const PRIVATE_PATHS = [
  PATHS.PROFILE,
  PATHS.LOANS,
  PATHS.INCOME,
  PATHS.EXPENSES,
  PATHS.GOALS,
] as const;