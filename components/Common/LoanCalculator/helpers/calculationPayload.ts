import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { Currency } from "@/contexts/currency";
import { sanitizeROI } from "@/helpers/numbers";
import { PrepaymentInterval } from "@/hooks/Loan/usePrepayments";
import type { Prepayment } from "@/hooks/Loan/usePrepayments";
import { LoanCalculatorType } from "@/types/ConfigTypes";
import type { Tenure } from "@/types/ConfigTypes";
import {
    CalculationPrepaymentInterval,
    CalculationType,
} from "@/types/Loan/CalculationTypes";
import type {
    CalculationMonthChange,
    CalculationPrepayment,
    CreateLoanCalculationPayload,
} from "@/types/Loan/CalculationTypes";
import type { AmortisationOverrides, MonthOverride } from "@/types/Loan/LoanTypes";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";

/**
 * The API stores money as an integer count of minor units, so every amount is
 * converted here rather than at each call site. Rounding is deliberate: the
 * calculator works in rupees, and a fractional rupee sent as-is would be
 * rejected outright rather than rounded by the server.
 */
export const toPaise = (amount: number): number => Math.round(amount * 100);

const INTERVAL_BY_PREPAYMENT_INTERVAL: Record<
    PrepaymentInterval,
    CalculationPrepaymentInterval
> = {
    [PrepaymentInterval.ONE_TIME]: CalculationPrepaymentInterval.ONE_TIME,
    [PrepaymentInterval.MONTHLY]: CalculationPrepaymentInterval.MONTHLY,
    [PrepaymentInterval.QUARTERLY]: CalculationPrepaymentInterval.QUARTERLY,
    [PrepaymentInterval.HALF_ANNUALLY]: CalculationPrepaymentInterval.HALF_ANNUALLY,
    [PrepaymentInterval.ANNUALLY]: CalculationPrepaymentInterval.ANNUALLY,
};

/**
 * `COMMON` is an analytics grouping covering several calculators at once, so it
 * has no single saveable scenario. A calculator reporting it gets no payload,
 * and the caller keeps the save affordance hidden rather than inventing a type.
 */
const CALCULATION_TYPE_BY_CALCULATOR: Record<LoanCalculatorType, CalculationType | null> = {
    [LoanCalculatorType.HOME]: CalculationType.HOME,
    [LoanCalculatorType.CAR]: CalculationType.CAR,
    [LoanCalculatorType.PERSONAL]: CalculationType.PERSONAL,
    [LoanCalculatorType.COMMON]: null,
};

export const getCalculationType = (
    loanCalculatorType: LoanCalculatorType
): CalculationType | null => CALCULATION_TYPE_BY_CALCULATOR[loanCalculatorType];

/**
 * Only the keys the user actually set are sent. A change that did not touch the
 * EMI has no `emi` key at all, because the API reads an absent key as "inherits
 * whatever was in force" and a zero as "the EMI is now zero".
 */
const toMonthChange = (
    monthIndex: number,
    change: MonthOverride
): CalculationMonthChange => {
    const monthChange: CalculationMonthChange = { monthIndex };

    if (change.emi !== undefined) {
        monthChange.emi = toPaise(change.emi);
    }
    if (change.prepayment !== undefined) {
        monthChange.prepayment = toPaise(change.prepayment);
    }
    if (change.disbursement !== undefined) {
        monthChange.additionalDisbursement = toPaise(change.disbursement);
    }
    if (change.roi !== undefined) {
        monthChange.rateOfInterest = change.roi;
    }

    return monthChange;
};

const toPrepayment = (prepayment: Prepayment): CalculationPrepayment => ({
    amount: toPaise(prepayment.amount),
    startMonth: prepayment.startDate.format("YYYY-MM"),
    interval: INTERVAL_BY_PREPAYMENT_INTERVAL[prepayment.interval],
});

/** Everything the calculator currently holds, in its own vocabulary. */
export type CalculationDraft = {
    loanCalculatorType: LoanCalculatorType;
    currency: Currency;
    loanAmount: number;
    roi: string;
    tenure: Tenure;
    startMonth: Dayjs;
    prepayments: Prepayment[];
    overrides: AmortisationOverrides;
};

export type CalculationLabels = {
    name: string;
    description: string;
};

/**
 * The scenario as the API should store it.
 *
 * Null when the calculator has no saveable scenario type, so a caller cannot
 * send one by accident. A prepayment row the user left at zero is dropped: it is
 * a field nobody filled in, not a plan to prepay nothing. When that leaves
 * nothing to say, the key is left out rather than sent as an empty list.
 */
export const buildCalculationPayload = (
    draft: CalculationDraft,
    labels: CalculationLabels
): CreateLoanCalculationPayload | null => {
    const calculationType = getCalculationType(draft.loanCalculatorType);

    if (calculationType === null) {
        return null;
    }

    /*
     * The rate is still being typed more often than not — "8." is a normal
     * intermediate state — so an unparseable value falls back to zero rather
     * than sending NaN, which the API would reject for a reason the user cannot
     * act on.
     */
    const rateOfInterest = Number(sanitizeROI(draft.roi));

    const prepayments = draft.prepayments
        .filter((prepayment) => prepayment.amount > 0)
        .map(toPrepayment);

    const monthChanges = Object.entries(draft.overrides)
        .map(([monthIndex, change]) => toMonthChange(Number(monthIndex), change))
        // Explicit, because key order is an object detail rather than a
        // guarantee, and a payload that reorders itself between saves is
        // needlessly hard to diff.
        .sort((a, b) => a.monthIndex - b.monthIndex);

    return {
        name: labels.name.trim(),
        description: labels.description.trim(),
        calculationType,
        currency: draft.currency,
        loan: {
            loanAmount: toPaise(draft.loanAmount),
            rateOfInterest: Number.isFinite(rateOfInterest) ? rateOfInterest : 0,
            tenure: { years: draft.tenure.years, months: draft.tenure.months },
            startMonth: draft.startMonth.format("YYYY-MM"),
        },
        // Conditional spreads, for the same reason `compactPayload` exists on the
        // service layer: an absent optional must never reach the wire as a key
        // holding an empty list.
        ...(prepayments.length > 0 ? { prepayments } : {}),
        ...(monthChanges.length > 0 ? { monthChanges } : {}),
    };
};

/**
 * The inverse of {@link buildCalculationPayload}: a saved scenario back into the
 * calculator's own vocabulary.
 *
 * Every conversion here is the mirror of the one that went out, because a scenario
 * that came back in the wrong units would silently produce a different loan — an
 * EMI off by a factor of a hundred reads as a plausible number, not as a bug.
 */
export const toCalculationDraft = (
    calculation: SavedLoanCalculation
): CalculationDraft => ({
    loanCalculatorType: CALCULATOR_BY_CALCULATION_TYPE[calculation.calculationType],
    currency: calculation.currency,
    loanAmount: toRupees(calculation.loan.loanAmount),
    // A string, because that is what the rate input holds. `sanitizeROI` already
    // caps it at two decimals, which is what the API accepted on the way in.
    roi: sanitizeROI(String(calculation.loan.rateOfInterest)),
    tenure: { years: calculation.loan.tenure.years, months: calculation.loan.tenure.months, days: 0 },
    /*
     * `YYYY-MM` is turned into the first of that month, matching how the picker
     * normalises a date. Without this the schedule would be keyed on whatever day
     * of the month the browser happened to parse.
     */
    startMonth: dayjs(`${calculation.loan.startMonth}-01`).startOf("month"),
    prepayments: (calculation.prepayments ?? []).map(toPrepaymentFromWire),
    overrides: toOverrides(calculation.monthChanges ?? []),
});

/** Paise back to rupees. The mirror of {@link toPaise}. */
const toRupees = (amount: number): number => amount / 100;

const PREPAYMENT_INTERVAL_BY_CODE: Record<
    CalculationPrepaymentInterval,
    PrepaymentInterval
> = {
    [CalculationPrepaymentInterval.ONE_TIME]: PrepaymentInterval.ONE_TIME,
    [CalculationPrepaymentInterval.MONTHLY]: PrepaymentInterval.MONTHLY,
    [CalculationPrepaymentInterval.QUARTERLY]: PrepaymentInterval.QUARTERLY,
    [CalculationPrepaymentInterval.HALF_ANNUALLY]: PrepaymentInterval.HALF_ANNUALLY,
    [CalculationPrepaymentInterval.ANNUALLY]: PrepaymentInterval.ANNUALLY,
};

const CALCULATOR_BY_CALCULATION_TYPE: Record<CalculationType, LoanCalculatorType> = {
    [CalculationType.HOME]: LoanCalculatorType.HOME,
    [CalculationType.CAR]: LoanCalculatorType.CAR,
    [CalculationType.PERSONAL]: LoanCalculatorType.PERSONAL,
};

/**
 * A stable id per row, so React can key the restored rows.
 *
 * Derived from the index rather than `Date.now()` because two scenarios restored in
 * the same millisecond would otherwise produce colliding keys, and the input rows
 * are matched by start date as well as id.
 */
const toPrepaymentFromWire = (
    wire: CalculationPrepayment,
    index: number
): Prepayment => ({
    id: index + 1,
    amount: toRupees(wire.amount),
    startDate: dayjs(`${wire.startMonth}-01`).startOf("month"),
    interval: PREPAYMENT_INTERVAL_BY_CODE[wire.interval],
});

/**
 * Month changes back into the overrides the schedule reads, keyed by month index.
 *
 * A change that carries none of the four values is dropped rather than stored as an
 * empty object: the schedule treats an entry with no fields as "no change here", so
 * keeping it would inflate the change count and make `hasManualChanges` claim the
 * scenario was hand-edited when it was not.
 */
const toOverrides = (
    monthChanges: CalculationMonthChange[]
): AmortisationOverrides => {
    const overrides: AmortisationOverrides = {};

    for (const change of monthChanges) {
        const override: MonthOverride = {};

        if (change.emi !== undefined) {
            override.emi = toRupees(change.emi);
        }
        if (change.prepayment !== undefined) {
            override.prepayment = toRupees(change.prepayment);
        }
        if (change.additionalDisbursement !== undefined) {
            override.disbursement = toRupees(change.additionalDisbursement);
        }
        if (change.rateOfInterest !== undefined) {
            override.roi = change.rateOfInterest;
        }

        if (Object.keys(override).length > 0) {
            overrides[change.monthIndex] = override;
        }
    }

    return overrides;
};