/**
 * Date-only fields (`date`, `startDate`, `endDate`, `targetDate`) are plain
 * calendar dates: `YYYY-MM-DD`, no time component and no timezone. Parsing them
 * as UTC and formatting them back shifts them by a day in any timezone west of
 * Greenwich, so every helper here works on the string parts directly and never
 * constructs a `Date` from one.
 *
 * `createdAt` and friends are full ISO 8601 UTC timestamps, which are formatted
 * in the user's local timezone.
 */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isDateOnly = (value: string): boolean => DATE_ONLY_PATTERN.test(value);

/** Today as `YYYY-MM-DD` in the user's local timezone. */
export const todayAsDateOnly = (): string => toDateOnly(new Date());

/** A local `Date` as `YYYY-MM-DD`, without crossing a UTC boundary. */
export const toDateOnly = (date: Date): string => {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * `2026-03-15` becomes `15 Mar 2026`. Written by string slicing rather than
 * `new Date(value)`, which would parse the value as UTC midnight and render the
 * previous day for anyone west of Greenwich.
 */
export const formatDateOnly = (value: string | null | undefined): string => {
  if (!value || !DATE_ONLY_PATTERN.test(value)) {
    return "-";
  }

  const year = value.slice(0, 4);
  const month = MONTH_NAMES[Number(value.slice(5, 7)) - 1];
  const day = Number(value.slice(8, 10));

  return `${day} ${month} ${year}`;
};

/** A full ISO timestamp, rendered in the viewer's local timezone. */
export const formatTimestamp = (value: string | null | undefined): string => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Whole days between two calendar dates, counting `from` as day zero. Compares
 * the string parts as UTC midnights, which is safe because both operands are
 * date-only and no timezone shift is involved.
 */
export const daysBetweenDateOnly = (from: string, to: string): number => {
  if (!DATE_ONLY_PATTERN.test(from) || !DATE_ONLY_PATTERN.test(to)) {
    return 0;
  }

  const start = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10))
  );
  const end = Date.UTC(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10))
  );

  return Math.round((end - start) / 86_400_000);
};

/** `"loan_repayment"` becomes `"Loan repayment"` for display. */
export const humaniseEnumValue = (value: string): string => {
  const words = value.split("_");

  return words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
    )
    .join(" ");
};