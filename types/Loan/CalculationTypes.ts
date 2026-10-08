import type { Currency } from "@/contexts/currency";
import type { ListResponse } from "@/types/FinanceTypes";

/**
 * The calculator family a scenario was saved from. Deliberately its own enum
 * rather than `LoanCalculatorType`: `COMMON` is an analytics grouping with no
 * saveable scenario, and must not be reachable from this boundary.
 */
export enum CalculationType {
    HOME = "HOME",
    CAR = "CAR",
    PERSONAL = "PERSONAL",
}

/** How often a prepayment repeats. `ONE_TIME` fires once and never recurs. */
export enum CalculationPrepaymentInterval {
    ONE_TIME = "ONE_TIME",
    MONTHLY = "MONTHLY",
    QUARTERLY = "QUARTERLY",
    HALF_ANNUALLY = "HALF_ANNUALLY",
    ANNUALLY = "ANNUALLY",
}

/**
 * Every money field on this boundary is an **integer count of paise**, never a
 * rupee decimal and never a float. The calculator works in rupees, so the
 * conversion happens once, where a payload is built.
 */
export type CalculationMoney = number;

/**
 * `YYYY-MM`. A month and deliberately not a date: the schedule is built in whole
 * months, so a day would imply a precision the calculation does not have.
 */
export type CalculationMonth = string;

export type CalculationTenure = {
    years: number;
    months: number;
};

export type CalculationLoan = {
    loanAmount: CalculationMoney;
    /** Annual percentage, 0-100. Not money: never divided by 100. */
    rateOfInterest: number;
    tenure: CalculationTenure;
    startMonth: CalculationMonth;
};

export type CalculationPrepayment = {
    amount: CalculationMoney;
    startMonth: CalculationMonth;
    interval: CalculationPrepaymentInterval;
};

/**
 * One month of the schedule the user changed by hand.
 *
 * `rateOfInterest` and `emi` are standing instructions that hold from
 * `monthIndex` to the end of the tenure; `prepayment` and
 * `additionalDisbursement` apply to that month alone. An absent key means
 * "unchanged", which is not the same as a zero — the API keeps the distinction,
 * so it has to survive the round trip.
 */
export type CalculationMonthChange = {
    /** Zero-based: index 0 is the first instalment month. */
    monthIndex: number;
    emi?: CalculationMoney;
    prepayment?: CalculationMoney;
    /**
     * Extra principal advanced in this month, raising the balance from here on.
     * Named `additionalDisbursement` on the wire because `disbursement` alone
     * does not say the principal was advanced rather than written off.
     */
    additionalDisbursement?: CalculationMoney;
    rateOfInterest?: number;
};

export type SavedLoanCalculation = {
    id: string;
    name: string;
    description: string | null;
    calculationType: CalculationType;
    currency: Currency;
    loan: CalculationLoan;
    prepayments: CalculationPrepayment[];
    monthChanges: CalculationMonthChange[];
    createdAt: string;
    updatedAt: string;
};

/**
 * What the calculator sends. Inputs only: the schedule is derived, so it is
 * never stored and never round-tripped. Recomputing it on load is what keeps a
 * saved scenario from contradicting itself after a change to the maths.
 */
export type CreateLoanCalculationPayload = {
    name: string;
    /** Sent even when blank; the API normalises a blank description to null. */
    description: string;
    calculationType: CalculationType;
    currency: Currency;
    loan: CalculationLoan;
    /**
     * Omitted entirely when the scenario has no prepayment. A plain loan with no
     * prepaying is a normal thing to save, and an empty list would read as
     * "every prepayment was cleared" rather than "there were none".
     */
    prepayments?: CalculationPrepayment[];
    /** Omitted entirely when no month of the schedule was edited by hand. */
    monthChanges?: CalculationMonthChange[];
};

export type CreateLoanCalculationResponse = {
    calculation: SavedLoanCalculation;
};

export type CalculationsList = ListResponse<SavedLoanCalculation>;