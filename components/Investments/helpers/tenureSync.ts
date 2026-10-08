import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { getStringValue } from "@/helpers/recordForm";
import type { FormValues } from "@/types/RecordFormTypes";

/**
 * Keeps a start date, an end date and a term of years/months/days telling one story.
 *
 * The API stores the **term** and nothing else — an investment has no `endDate` field, and the
 * endpoint is strict, so sending one is rejected outright. The end date is therefore not stored
 * but *derived*: arithmetic over the start date and the term, shown in the form because a term
 * of "5 years, 0 months, 0 days" is harder to picture than a date you can read back.
 *
 * Which of the two spellings is authoritative depends entirely on which one the user touched
 * last, and that is the only rule here: **the latest selection wins.** Set an end date and the
 * three dropdowns are rewritten to match it; set any dropdown and the end date moves to match.
 * Neither one is allowed to sit contradicting the other, because there is no way to tell from
 * the request which of the two the user actually meant.
 */

/** The three fields a term is entered in, in the order they read on screen. */
const TENURE_FIELDS = ["tenureYears", "tenureMonths", "tenureDays"] as const;

const START_FIELD = "startDate";
const END_FIELD = "endDate";

/**
 * The bounds the API holds the term to.
 *
 * Read from `investment.validators.ts` rather than invented here. The dropdowns are built to
 * these, and the decomposition below has to land inside them — a picker that offered a 40-day
 * option would produce a request the server refuses.
 */
const MAX_YEARS = 50;
const MAX_MONTHS = 11;
const MAX_DAYS = 30;

export type Term = { years: number; months: number; days: number };

/** A term of nothing at all, which is what a holding with no term looks like. */
const NO_TERM: Term = { years: 0, months: 0, days: 0 };

const hasTerm = (term: Term): boolean =>
  term.years + term.months + term.days > 0;

/** The term as the dropdowns currently hold it, treating a blank as zero. */
export const termFromValues = (values: FormValues): Term => ({
  years: Number(getStringValue(values, "tenureYears")) || 0,
  months: Number(getStringValue(values, "tenureMonths")) || 0,
  days: Number(getStringValue(values, "tenureDays")) || 0,
});

/**
 * Whole calendar months from `start` to `end`, the largest count that does not overshoot.
 *
 * Worked out by stepping rather than by subtracting the two year/month pairs, because the
 * subtraction is wrong at the end of a month: Jan 31 to Mar 1 looks like two months by
 * subtraction, but `start.add(2, "month")` is Mar 31 — a month *past* the end — so the answer is
 * one month and a day. Stepping the count down until the anchor lands on or before the end is
 * what makes `start.add(term).add(days)` land back on `end`.
 */
const wholeMonthsBetween = (start: Dayjs, end: Dayjs): number => {
  let months = (end.year() - start.year()) * 12 + (end.month() - start.month());

  while (months > 0 && start.add(months, "month").isAfter(end)) {
    months -= 1;
  }

  return months;
};

/**
 * The term between two dates, or `null` when it cannot be one.
 *
 * `null` for an end date before the start — there is no term that runs backwards — and the
 * caller leaves the other fields alone rather than inventing a negative one. The rule that says
 * so is a cross-field check on the form, which is where the message belongs.
 */
export const termBetween = (startDate: string, endDate: string): Term | null => {
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  if (!start.isValid() || !end.isValid() || end.isBefore(start, "day")) {
    return null;
  }

  const months = wholeMonthsBetween(start, end);

  /*
   * Years are capped rather than allowed to run past what the API accepts. The only way to get
   * here is a start date decades before the end date, and the answer is then short by
   * construction — but a truncated term is better than a request the server refuses, and a
   * `days` figure measured from an anchor the answer never reaches would be nonsense on top.
   */
  const cappedMonths = Math.min(months, MAX_YEARS * 12);

  return {
    years: Math.floor(cappedMonths / 12),
    months: cappedMonths % 12,
    days:
      cappedMonths === months
        ? end.diff(start.add(months, "month"), "day")
        : 0,
  };
};

/** The date a term runs out on. `null` when there is no start date to count from. */
export const dateAfter = (startDate: string, term: Term): string | null => {
  const start = dayjs(startDate);

  if (!start.isValid()) {
    return null;
  }

  return start
    .add(Math.min(term.years, MAX_YEARS) * 12 + term.months, "month")
    .add(term.days, "day")
    .format("YYYY-MM-DD");
};

/**
 * What one change does to the dates and the term around it.
 *
 * Returns only the fields it is *not* allowed to touch: the field being changed is applied by
 * the caller, so a patch naming it would be a race between the two writes.
 */
export const syncTerminateOnChange = ({
  name,
  value,
  current,
}: {
  name: string;
  value: string | boolean;
  current: FormValues;
}): FormValues => {
  const startDate = getStringValue(current, START_FIELD);

  /*
   * With no start date there is nothing to count from, so nothing moves. The end date is
   * disabled in this state anyway — this is the guard for a value that arrives some other way.
   */
  if (!startDate) {
    return {};
  }

  /* An end date is the latest word, so it rewrites all three dropdowns. */
  if (name === END_FIELD) {
    const endDate = String(value);

    if (!endDate) {
      return {};
    }

    const term = termBetween(startDate, endDate);

    if (!term) {
      return {};
    }

    return {
      tenureYears: String(term.years),
      tenureMonths: String(term.months),
      tenureDays: String(term.days),
    };
  }

  /* One of the dropdowns: it rewrites the end date, and the other two are left as they are. */
  if ((TENURE_FIELDS as readonly string[]).includes(name)) {
    const term = termFromValues(current);

    if (name === "tenureYears") {
      term.years = Number(String(value)) || 0;
    } else if (name === "tenureMonths") {
      term.months = Number(String(value)) || 0;
    } else {
      term.days = Number(String(value)) || 0;
    }

    if (!hasTerm(term)) {
      // A term of nothing is no term, and a term of nothing has no end date to show.
      return { endDate: "" };
    }

    const endDate = dateAfter(startDate, term);

    return endDate ? { endDate } : {};
  }

  /*
   * A new start date moves the end date with it, because a term is a *length* and the length has
   * not changed. Dropping the start date drops the end date with it, rather than leaving an end
   * date floating with nothing anchoring it.
   */
  if (name === START_FIELD) {
    const term = termFromValues(current);
    const movedStart = String(value);

    if (!movedStart || !hasTerm(term)) {
      return { endDate: "" };
    }

    const endDate = dateAfter(movedStart, term);

    return { endDate: endDate ?? "" };
  }

  return {};
};

/**
 * Fills the end date in when an existing holding is opened for editing.
 *
 * The record carries the term but not the end date, so without this the box would open blank
 * beside three dropdowns that plainly already hold an answer — and the first edit would look
 * like the holding had lost its maturity.
 */
export const deriveInvestmentEditValues = (
  seeded: FormValues,
  _record: Record<string, unknown>
): FormValues => {
  const startDate = getStringValue(seeded, START_FIELD);
  const term = termFromValues(seeded);

  if (!startDate || !hasTerm(term)) {
    return { ...seeded, [END_FIELD]: "" };
  }

  return { ...seeded, [END_FIELD]: dateAfter(startDate, term) ?? "" };
};

export { MAX_DAYS, MAX_MONTHS, MAX_YEARS };