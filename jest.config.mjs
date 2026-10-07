import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import("jest").Config} */
const customJestConfig = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // `app/**` keeps the existing page tests in their `__tests__` folders. The other
  // patterns allow a test to sit beside the file it covers. Listed one per tree
  // rather than with a brace pattern, which this glob does not expand.
  testMatch: [
    "<rootDir>/app/**/__tests__/**/*.test.(ts|tsx)",
    "<rootDir>/components/**/*.test.(ts|tsx)",
    "<rootDir>/contexts/**/*.test.(ts|tsx)",
    "<rootDir>/helpers/**/*.test.(ts|tsx)",
    "<rootDir>/services/**/*.test.(ts|tsx)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transformIgnorePatterns: ["/node_modules/(?!(@mui|@emotion|@babel)/)"],
};

export default createJestConfig(customJestConfig);
