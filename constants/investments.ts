import { humaniseEnumValue } from "@/helpers/dates";
import { CompoundingFrequency, InvestmentStatus, InvestmentType } from "@/types/FinanceTypes";

/** Labels for the investment vocabulary, plus the sort and filter options built from it. */

/** Acronyms and abbreviations the generic humaniser would mangle. */
const LABEL_OVERRIDES: Record<string, string> = {
  fd: "Fixed deposit",
  rd: "Recurring deposit",
  sip: "SIP",
  lumpsum: "Lump sum",
  ppf: "PPF",
  epf: "EPF",
  nps: "NPS",
  nsc: "NSC",
  tlw: "Tax-free wrapper",
};

const labelFor = (value: string): string =>
  LABEL_OVERRIDES[value] ?? humaniseEnumValue(value);

/** Display label for any contract enum value, overrides included. */
export const labelForEnumValue = labelFor;

const option = <T extends string>(value: T) => ({ value, label: labelFor(value) });

export const INVESTMENT_TYPE_OPTIONS = [
  option(InvestmentType.FD),
  option(InvestmentType.RD),
  option(InvestmentType.SIP),
  option(InvestmentType.LUMPSUM),
  option(InvestmentType.PPF),
  option(InvestmentType.EPF),
  option(InvestmentType.NPS),
  option(InvestmentType.SAVINGS),
  option(InvestmentType.BONDS),
  option(InvestmentType.NSC),
  option(InvestmentType.TLW),
  option(InvestmentType.STOCKS),
  option(InvestmentType.MUTUAL_FUND),
  option(InvestmentType.GOLD),
  option(InvestmentType.REAL_ESTATE),
  option(InvestmentType.CRYPTO),
  option(InvestmentType.OTHER),
];

export const INVESTMENT_STATUS_OPTIONS = [
  option(InvestmentStatus.ACTIVE),
  option(InvestmentStatus.MATURED),
  option(InvestmentStatus.CLOSED),
];

export const COMPOUNDING_OPTIONS = [
  { value: String(CompoundingFrequency.YEARLY), label: "Yearly" },
  { value: String(CompoundingFrequency.HALF_YEARLY), label: "Half-yearly" },
  { value: String(CompoundingFrequency.QUARTERLY), label: "Quarterly" },
  { value: String(CompoundingFrequency.MONTHLY), label: "Monthly" },
];

export const INVESTMENT_SORTS = [
  "createdAt",
  "updatedAt",
  "title",
  "type",
  "startDate",
  "amount",
  "monthlyAmount",
  "rate",
  "status",
] as const;

/**
 * Sort fields the API will not accept.
 *
 * `amount` and `monthlyAmount` are real fields but only one of them is ever populated, and
 * which one depends on the holding's type — so sorting on either would file most of a list
 * together under "no value". Sorted by title or start date instead, which every record has.
 */
export const COMPENSATING_SORTS = ["createdAt", "updatedAt", "title", "startDate"] as const;