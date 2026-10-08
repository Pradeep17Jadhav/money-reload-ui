import { formatDateOnly } from "@/helpers/dates";
import { formatPaise, formatPercent } from "@/helpers/money";
import { CellStack } from "@/components/Records/RecordTable/RecordTable";
import type { TableColumn } from "@/components/Records/RecordTable/RecordTable";
import {
  COMPOUNDING_OPTIONS,
  INVESTMENT_STATUS_OPTIONS,
  INVESTMENT_TYPE_OPTIONS,
  labelForEnumValue,
} from "@/constants/investments";
import { INVESTMENT_SORTS } from "@/constants/investments";
import { sortOptions } from "@/constants/records";
import type { MultiFilter } from "@/components/Records/RecordToolbar/RecordToolbar";
import type { SummaryTile } from "@/components/Records/SummaryTiles/SummaryTiles";
import type { FieldConfig } from "@/types/RecordFormTypes";
import type { Investment } from "@/types/FinanceTypes";
import {
  isFixedReturn,
  isRecurring,
  projectInvestment,
  FIXED_RETURN_TYPES,
  RECURRING_TYPES,
} from "@/components/Investments/helpers/investmentProjection";
import type { InvestmentProjection } from "@/components/Investments/helpers/investmentProjection";
import { MAX_DAYS, MAX_MONTHS, MAX_YEARS } from "@/components/Investments/helpers/tenureSync";
import { InvestmentType } from "@/types/FinanceTypes";

/** Everything the API's investment vocabulary contains, split by what each group needs. */
const ALL_TYPES: InvestmentType[] = Object.values(InvestmentType);

/** Funded by instalments rather than one lump sum. */
const MONTHLY_TYPES = RECURRING_TYPES;

/** Funded by a single amount. Everything that is not recurring. */
const ONE_TIME_TYPES = ALL_TYPES.filter(
  (type) => !RECURRING_TYPES.includes(type)
);

/** Worth what the market says, so no rate and no term can value them. */
const MARKET_LINKED_TYPES = ALL_TYPES.filter(
  (type) => !FIXED_RETURN_TYPES.includes(type)
);

/**
 * Fixed-return types with a term to run.
 *
 * A savings balance is the exception: it has no maturity, so asking for a term would invent
 * an end date the user never mentioned.
 */
const TERM_TYPES = FIXED_RETURN_TYPES.filter(
  (type) => type !== InvestmentType.SAVINGS
);

/** `0` through `max`, as the string values a dropdown can carry. */
const countOptions = (max: number): { value: string; label: string }[] =>
  Array.from({ length: max + 1 }, (_, index) => ({
    value: String(index),
    label: String(index),
  }));

/**
 * The form.
 *
 * **What a holding needs to record is not the same for any two of them**, so the fields that
 * apply depend on the type: an FD wants an amount, a rate and a term; an SIP wants a monthly
 * amount, and may want a step-up; a shareholding wants neither a rate nor a term, and instead
 * wants what it is worth right now.
 *
 * Expressed as one list with `visibleWhen` rather than a list built per type. Two reasons.
 * `validateForm` only holds you to a field that is **visible**, so `required` means "required
 * in this context" without any per-type plumbing — a term is required for a deposit and simply
 * absent for a savings balance. And `buildPayload` sends only what is visible, so a field that
 * is not asked for is not sent, which is what lets the API refuse a rate on a market-linked
 * holding rather than storing a number nothing could act on.
 */
export const INVESTMENT_FIELDS: FieldConfig[] = [
  {
    kind: "text",
    name: "title",
    label: "title",
    required: true,
    minLength: 1,
    maxLength: 150,
  },
  {
    kind: "select",
    name: "type",
    label: "type",
    required: true,
    options: INVESTMENT_TYPE_OPTIONS,
  },
  { kind: "date", name: "startDate", label: "start date", required: true },

  /*
   * The end date is the term spelled as a date, so it sits next to the start date rather than
   * down with the dropdowns it keeps in step. Neither is stored as an end: the API holds the
   * term and works the date out, so this one is `formOnly` and never sent.
   *
   * Disabled until there is a start date, because a date with nothing to count forward from is
   * not a term — and shown only for the types that have one, since a savings balance accrues and
   * a share price has no maturity.
   */
  {
    kind: "date",
    name: "endDate",
    label: "end date",
    visibleWhen: { name: "type", equals: TERM_TYPES },
    formOnly: true,
    enabledWhen: { name: "startDate" },
  },

  /*
   * Exactly one amount field, because the type decides which one means anything. Sending both
   * would give one holding two amounts and no rule about which one the return was measured on.
   */
  {
    kind: "money",
    name: "amount",
    label: "amount",
    required: true,
    visibleWhen: { name: "type", equals: ONE_TIME_TYPES },
  },
  {
    kind: "money",
    name: "monthlyAmount",
    label: "monthly amount",
    required: true,
    visibleWhen: { name: "type", equals: RECURRING_TYPES },
  },

  {
    kind: "percent",
    name: "rate",
    label: "rate of return",
    required: true,
    visibleWhen: { name: "type", equals: FIXED_RETURN_TYPES },
  },

  /*
   * The one field a computed return cannot supply. A share price is not arithmetic over a rate
   * and a term, so it is stored and the user maintains it — and without it the row could only
   * ever show what went in.
   */
  {
    kind: "money",
    name: "currentValue",
    label: "current value",
    required: true,
    visibleWhen: { name: "type", equals: MARKET_LINKED_TYPES },
  },

  /*
   * A term entered as three pickers rather than three typed boxes.
   *
   * A term is a bounded, small set of choices — at most 50 years, 11 months, 30 days — so a
   * free-text number was asking the user to know a range the form already knows, and offered no
   * way to discover it. Worse, the three boxes could hold values that no single term describes,
   * such as 11 months *and* 30 days, which the API rejects and the user has no way to predict.
   * The options are exactly the bounds the server holds.
   */
  {
    kind: "select",
    name: "tenureYears",
    label: "tenure (years)",
    options: countOptions(MAX_YEARS),
    numeric: true,
    required: true,
    visibleWhen: { name: "type", equals: TERM_TYPES },
  },
  {
    kind: "select",
    name: "tenureMonths",
    label: "tenure (months)",
    options: countOptions(MAX_MONTHS),
    numeric: true,
    required: true,
    visibleWhen: { name: "type", equals: TERM_TYPES },
  },
  {
    kind: "select",
    name: "tenureDays",
    label: "tenure (days)",
    options: countOptions(MAX_DAYS),
    numeric: true,
    required: true,
    visibleWhen: { name: "type", equals: TERM_TYPES },
  },
  {
    kind: "select",
    name: "compoundingsPerYear",
    label: "compounding frequency",
    options: COMPOUNDING_OPTIONS,
    // The API takes the number of compoundings a year; a dropdown can only carry strings.
    numeric: true,
    visibleWhen: { name: "type", equals: FIXED_RETURN_TYPES },
  },
  {
    kind: "percent",
    name: "stepUpPercent",
    label: "annual step-up",
    visibleWhen: { name: "type", equals: [InvestmentType.SIP] },
  },

  { kind: "text", name: "institution", label: "institution", maxLength: 120 },
  { kind: "text", name: "reference", label: "account / folio number", maxLength: 60 },
  { kind: "select", name: "status", label: "status", options: INVESTMENT_STATUS_OPTIONS },
  { kind: "text", name: "notes", label: "notes", maxLength: 2000, multiline: true },
];

/**
 * The columns, given a way to read an investment's figures and, optionally, the single type on
 * screen.
 *
 * **Each type earns its own table**, because the figures that matter are not the same for any
 * two of them. A deposit is understood by its rate, its compounding and when it matures; a SIP
 * by what goes in each month and whether it steps up; a shareholding by what went in and what
 * it is worth now — with no rate, no compounding and no end date, because none of those exist
 * for a market price. Showing all of them together fills the table with columns that are dashes
 * for most rows, and dashes cost the eye as much as numbers do.
 *
 * `null` is the "everything" table, which is the union. That is the honest shape for a mixed
 * list: it has to carry the type column to say what each row is, and therefore every column
 * that any of them uses.
 */
export const investmentColumns = (
  projectionFor: (investment: Investment) => InvestmentProjection | null,
  type: InvestmentType | null = null
): TableColumn<Investment>[] => {
  const columns: TableColumn<Investment>[] = [
    {
      key: "title",
      header: "Holding",
      render: (investment) => (
        <CellStack
          primary={investment.title}
          secondary={
            type === null ? investment.institution ?? labelForEnumValue(investment.type) : investment.institution ?? undefined
          }
        />
      ),
    },
  ];

  // Only in the mixed table: on a single type's table the tab already says which it is, and
  // repeating it in every row is the column being widest for no information.
  if (type === null) {
    columns.push({
      key: "type",
      header: "Type",
      render: (investment) => labelForEnumValue(investment.type),
    });
  }

  // The monthly payment is only a fact for a recurring holding, and it is the figure a SIP is
  // actually run by — so it leads its own table rather than being buried in a note.
  if (type !== null && RECURRING_TYPES.includes(type)) {
    columns.push({
      key: "monthly",
      header: "Monthly",
      numeric: true,
      render: (investment) =>
        investment.monthlyAmount === null
          ? "-"
          : formatPaise(investment.monthlyAmount),
    });
  }

  columns.push({
    key: "invested",
    header: type !== null && RECURRING_TYPES.includes(type) ? "Total paid" : "Invested",
    numeric: true,
    render: (investment) => {
      const projection = projectionFor(investment);

      /*
       * What a single-type table wants to show for a recurring holding is what it will have
       * paid *by the end*, which is the figure a return is measured against — not the single
       * monthly instalment, already given its own column.
       */
      if (projection) {
        return formatPaise(projection.invested);
      }

      return investment.amount === null ? "-" : formatPaise(investment.amount);
    },
  });

  /*
   * The rate only exists for a fixed return. On a single market-linked table the column is
   * omitted rather than filled with dashes, because there is no rate to show and a column of
   * nothing is worse than no column.
   */
  if (type === null || isFixedReturn(type)) {
    columns.push({
      key: "rate",
      header: "Rate",
      numeric: true,
      render: (investment) =>
        investment.rate === null ? "-" : formatPercent(investment.rate),
    });
  }

  // Only a SIP's instalment rises on its own, and by how much is most of what distinguishes it.
  if (type === InvestmentType.SIP) {
    columns.push({
      key: "stepUp",
      header: "Step-up",
      numeric: true,
      render: (investment) =>
        investment.stepUpPercent === null || investment.stepUpPercent === 0
          ? "-"
          : formatPercent(investment.stepUpPercent),
    });
  }

  columns.push({
    key: "value",
    header: "Worth now",
    numeric: true,
    render: (investment) => {
      const projection = projectionFor(investment);

      // A dash, not a zero: a zero is a claim that the holding is worth nothing, which is a
      // different and wrong answer from "there is not enough stored to say".
      return projection ? formatPaise(projection.currentValue) : "-";
    },
  });

  /*
   * What the holding is worth when its term runs out, rather than what it has gained so far.
   *
   * Replaces the profit column, which said the same thing less usefully: a gain is only
   * meaningful next to what was paid for it, and the invested column already carries that. The
   * maturity value is a figure a depositor is actually given — it is what the bank pays out, and
   * it is the number a reinvestment decision is made on — and unlike a profit it needs no
   * arithmetic on the reader's part to be understood.
 *
 * For a holding that has not matured this is still its end-of-term figure, not today's: a
 * deposit opened last month and maturing in four years is quoted here at what it will be worth
 * in four years. Worth *today* is the "Worth now" column beside it, so the two are never
 * confused for each other.
 */
columns.push({
    key: "maturity",
    header: "Maturity value",
    numeric: true,
    render: (investment) => {
      const projection = projectionFor(investment);

      // A dash, not a zero, for the same reason as "Worth now": a zero claims the holding is
      // worth nothing, which is a different and wrong answer from "there is not enough stored
      // to work it out".
      return projection ? formatPaise(projection.maturityValue) : "-";
    },
  });

  // An end date is a fact only where there is a term, so a savings balance and every
  // market-linked holding leave it out rather than showing a dash for each.
  if (type === null || (isFixedReturn(type) && type !== InvestmentType.SAVINGS)) {
    columns.push({
      key: "dates",
      header: "Started",
      render: (investment) => {
        const projection = projectionFor(investment);

        return (
          <CellStack
            primary={formatDateOnly(investment.startDate)}
            secondary={
              projection?.maturityDate
                ? `ends ${dateLabel(projection.maturityDate)}`
                : undefined
            }
          />
        );
      },
    });
  }

  return columns;
};

/**
 * `YYYY-MM-DD` as `05 Jan 2029`.
 *
 * Day, month and year, because a maturity is a date and not a month. It was "Jan 2029" until
 * the end date was dropped into the form, at which point a depositor could see *when* their
 * term ran out but the table could only tell them *which month* — and the day is the part they
 * are actually given.
 */
const dateLabel = (iso: string): string => {
  const [year, monthNumber, day] = iso.split("-");

  const names = [
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

  const month = names[Number(monthNumber) - 1];

  // Shown as stored rather than guessed at, so an unexpected shape is visible rather than
  // silently rendered as an empty label.
  return month && day ? `${day} ${month} ${year}` : iso;
};

export const INVESTMENT_FILTERS: MultiFilter[] = [
  { key: "type", label: "Type", options: INVESTMENT_TYPE_OPTIONS },
  { key: "status", label: "Status", options: INVESTMENT_STATUS_OPTIONS },
];

export const INVESTMENT_SORT_OPTIONS = sortOptions(INVESTMENT_SORTS);

export type InvestmentTotals = {
  totalInvested: number;
  totalCurrentValue: number;
  totalProfit: number;
  /** Holdings whose figures could not be worked out, and which contribute nothing above. */
  unresolved: number;
  recordCount: number;
  /**
   * The types actually present, so the screen can offer a table per type rather than a
   * seventeen-way menu of which the user owns two.
   */
  typesPresent: InvestmentType[];
  isLoading: boolean;
};

const EMPTY_TOTALS: InvestmentTotals = {
  totalInvested: 0,
  totalCurrentValue: 0,
  totalProfit: 0,
  unresolved: 0,
  recordCount: 0,
  typesPresent: [],
  isLoading: false,
};

/**
 * The tiles above the table.
 *
 * Summed in the browser rather than taken from an API aggregate, because nothing derived is
 * stored: every figure below is arithmetic over the records, and a server total could only
 * have counted the amounts and missed the returns entirely.
 */
export const investmentSummaryTiles = (totals: InvestmentTotals): SummaryTile[] => {
  const tiles: SummaryTile[] = [
    { label: "Invested", value: formatPaise(totals.totalInvested) },
    { label: "Worth now", value: formatPaise(totals.totalCurrentValue) },
    {
      label: "Profit",
      value: formatPaise(totals.totalProfit),
      subValue: "across every holding",
    },
    {
      label: "Holdings",
      value: String(totals.recordCount),
      subValue:
        totals.unresolved > 0
          ? `${totals.unresolved} could not be worked out`
          : undefined,
    },
  ];

  // Said only when something is wrong: a tile reading "0 could not be worked out" is noise.
  if (totals.unresolved > 0) {
    tiles.push({
      label: "Incomplete",
      value: String(totals.unresolved),
      subValue: "missing an amount or a value",
    });
  }

  return tiles;
};

export { EMPTY_TOTALS, projectInvestment };