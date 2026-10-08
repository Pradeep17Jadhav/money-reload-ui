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
  INVESTMENTS = "/investments",
  GOALS = "/goals",
}

export type PrivatePage = {
  to: string;
  label: string;
  tooltip: string;
};

/**
 * The routes that require a session, with the copy both navigation surfaces share.
 *
 * One list rather than a path array plus a label lookup inside `AuthMenu`: the toolbar
 * and the account menu have to agree on which routes are private *and* what they are
 * called, and two parallel structures are how they drift apart.
 */
export const PRIVATE_PAGES: PrivatePage[] = [
  { to: PATHS.PROFILE, label: "Profile", tooltip: "Your account" },
  { to: PATHS.LOANS, label: "Loans", tooltip: "Loans you are tracking" },
  { to: PATHS.INCOME, label: "Income", tooltip: "Income you have recorded" },
  {
    to: PATHS.EXPENSES,
    label: "Expenses",
    tooltip: "Expenses you have recorded",
  },
  {
    to: PATHS.INVESTMENTS,
    label: "Investments",
    tooltip: "Savings and investments you hold",
  },
  { to: PATHS.GOALS, label: "Goals", tooltip: "Goals you are saving towards" },
];

/**
 * Routes that require a session. Kept as data so the navbar and the guard can
 * agree on exactly which routes are private.
 */
export const PRIVATE_PATHS = PRIVATE_PAGES.map((page) => page.to);