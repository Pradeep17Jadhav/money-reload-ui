export type AmortisationRow = {
  /** Zero-based position in the schedule. Lets a month be addressed by index. */
  monthIndex: number;
  /** `YYYYMM` for a month, `YYYY` for a year. */
  year: number;
  principalPaid: number;
  prepayments: number;
  /**
   * Extra principal advanced in this month by an additional disbursement. A year
   * row carries the total advanced across its months.
   */
  disbursements: number;
  interestPaid: number;
  totalPaid: number;
  balance: number;
  loanPaidPercent: number;
  /**
   * The annual rate in force for this row, as a percentage. Always present so the
   * column can render, but only surfaced once the user has changed a rate.
   */
  interestRate: number;
  /** The EMI charged this month. Not a table column today. */
  emi: number;
};

/**
 * A manual change the user made to one month of the schedule.
 *
 * `emi` and `roi` carry forward to every later month, because a rate or instalment
 * change is a standing instruction rather than a one-off. `prepayment` and
 * `disbursement` apply to that month alone, which is what "prepay this month" and
 * "release more this month" each mean.
 */
export type MonthOverride = {
  emi?: number;
  prepayment?: number;
  /** Extra principal advanced in this month, raising the balance from here on. */
  disbursement?: number;
  roi?: number;
};

/** Keyed by `monthIndex`. Several months may carry changes at once. */
export type AmortisationOverrides = Record<number, MonthOverride>;

export type TableColumn = {
  key: string;
  label: string;
};

export type TableColumns = TableColumn[];

export enum AmortisationTableFrequency {
  Monthly = "MONTHLY",
  Yearly = "YEARLY",
}

export type LoanData = {
  loanAmount: number;
  rateOfInterest: number;
  tenureMonths: number;
  tenureWithPrepaymentMonths: number;
  emi: number;
  monthYear: number;
  hasPrepayments: boolean;
  totalPrepayments: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
};