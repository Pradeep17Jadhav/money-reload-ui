export enum LoanType {
  PERSONAL = "personal",
  HOME = "home",
  VEHICLE = "vehicle",
  EDUCATION = "education",
  BUSINESS = "business",
  MORTGAGE = "mortgage",
  GOLD = "gold",
  CREDIT_CARD = "credit_card",
  OTHER = "other",
}

export enum InterestType {
  FIXED = "fixed",
  FLOATING = "floating",
  REDUCING_BALANCE = "reducing_balance",
  SIMPLE = "simple",
}

export enum LoanStatus {
  ACTIVE = "active",
  CLOSED = "closed",
  PREPAID = "prepaid",
  FORECLOSED = "foreclosed",
  OVERDUE = "overdue",
}

export enum IncomeCategory {
  SALARY = "salary",
  FREELANCE = "freelance",
  BUSINESS = "business",
  INVESTMENT = "investment",
  INTEREST = "interest",
  DIVIDEND = "dividend",
  RENTAL = "rental",
  BONUS = "bonus",
  COMMISSION = "commission",
  REFUND = "refund",
  GIFT = "gift",
  OTHER = "other",
}

/** Shared by income and expense. */
export enum PaymentMode {
  CASH = "cash",
  CHEQUE = "cheque",
  UPI = "upi",
  NEFT = "neft",
  IMPS = "imps",
  /** National Automated Clearing House, the standing-debit rail. */
  NACH = "nach",
  NET_BANKING = "net_banking",
  CARD = "card",
  DD = "dd",
  OTHER = "other",
}

/** Shared by income and expense. */
export enum Destination {
  BANK_ACCOUNT = "bank_account",
  WALLET = "wallet",
  CASH = "cash",
  CARD = "card",
  INVESTMENT = "investment",
  OTHER = "other",
}

export enum RecurrenceFrequency {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  YEARLY = "yearly",
}

export enum ExpenseCategory {
  FOOD = "food",
  TRANSPORT = "transport",
  HOUSING = "housing",
  UTILITIES = "utilities",
  HEALTHCARE = "healthcare",
  EDUCATION = "education",
  SHOPPING = "shopping",
  ENTERTAINMENT = "entertainment",
  TRAVEL = "travel",
  INSURANCE = "insurance",
  INVESTMENT = "investment",
  LOAN_REPAYMENT = "loan_repayment",
  /** A single scheduled repayment on a loan. Pairs with `installmentType`. */
  INSTALLMENT = "installment",
  GIFT = "gift",
  DONATION = "donation",
  FEES = "fees",
  TAXES = "taxes",
  OTHER = "other",
}

/** Which loan an `installment` expense is paying down. */
export enum InstallmentType {
  HOME = "home",
  CAR = "car",
  PERSONAL = "personal",
  GOLD = "gold",
  EDUCATION = "education",
  BUSINESS = "business",
  VEHICLE = "vehicle",
  MORTGAGE = "mortgage",
  CREDIT_CARD = "credit_card",
  OTHER = "other",
}

/**
 * What the user is holding.
 *
 * Split by whether a return can be worked out from what is stored, because that is the only
 * distinction the app acts on:
 *
 * - **Fixed return** — the amount, rate and term fully determine the value, so it is derived
 *   on every read and stored nowhere.
 * - **Market-linked** — a price nothing here can predict, so the value *is* stored and the
 *   user maintains it as markets move.
 */
export enum InvestmentType {
  FD = "fd",
  RD = "rd",
  SIP = "sip",
  LUMPSUM = "lumpsum",
  PPF = "ppf",
  EPF = "epf",
  NPS = "nps",
  SAVINGS = "savings",
  BONDS = "bonds",
  NSC = "nsc",
  TLW = "tlw",
  STOCKS = "stocks",
  MUTUAL_FUND = "mutual_fund",
  GOLD = "gold",
  REAL_ESTATE = "real_estate",
  CRYPTO = "crypto",
  OTHER = "other",
}

export enum InvestmentStatus {
  ACTIVE = "active",
  MATURED = "matured",
  CLOSED = "closed",
}

/** How many times a year interest is added. */
export enum CompoundingFrequency {
  YEARLY = 1,
  HALF_YEARLY = 2,
  QUARTERLY = 4,
  MONTHLY = 12,
}

export type Investment = RecordTimestamps & {
  /** The user's own name for this holding. Never derived. */
  title: string;
  type: InvestmentType;
  /** `YYYY-MM-DD`. When the money went in. */
  startDate: string;
  /** Integer paise, for a type funded by one lump sum. */
  amount: number | null;
  /** Integer paise per month, for a type funded by instalments. */
  monthlyAmount: number | null;
  /** Annual percentage. Null on a market-linked holding, which has no rate. */
  rate: number | null;
  tenureYears: number | null;
  tenureMonths: number | null;
  tenureDays: number | null;
  compoundingsPerYear: number | null;
  /** Annual percentage the instalment rises. `sip` only. */
  stepUpPercent: number | null;
  /**
   * What it is worth, for a market-linked holding only. Maintained by the user, because this
   * app cannot read a market price and there is nowhere else to ask.
   */
  currentValue: number | null;
  institution: string | null;
  reference: string | null;
  notes: string | null;
  status: InvestmentStatus;
};

export type CreateInvestmentPayload = {
  title: string;
  type: InvestmentType;
  startDate: string;
  amount?: number;
  monthlyAmount?: number;
  rate?: number;
  tenureYears?: number;
  tenureMonths?: number;
  tenureDays?: number;
  compoundingsPerYear?: number;
  stepUpPercent?: number;
  currentValue?: number;
  institution?: string;
  reference?: string;
  notes?: string;
  status?: InvestmentStatus;
};

/**
 * No derived field appears in either payload — no maturity value, no profit, no return
 * percentage. Every one is arithmetic over the fields above, and the API refuses anything the
 * investment's type does not own.
 */
export type UpdateInvestmentPayload = Partial<CreateInvestmentPayload>;

export enum GoalCategory {
  EMERGENCY_FUND = "emergency_fund",
  VACATION = "vacation",
  EDUCATION = "education",
  HOME = "home",
  VEHICLE = "vehicle",
  RETIREMENT = "retirement",
  INVESTMENT = "investment",
  BUSINESS = "business",
  WEDDING = "wedding",
  DEBT_CLEARANCE = "debt_clearance",
  OTHER = "other",
}

export enum GoalPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum GoalStatus {
  ACTIVE = "active",
  ACHIEVED = "achieved",
  PAUSED = "paused",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

/** Every record carries these, plus a nullable `deletedAt` for soft deletes. */
export type RecordTimestamps = {
  id: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Loan = RecordTimestamps & {
  /**
   * The user's own name for this loan. Mandatory, and separate from `lender`, because one bank
   * issues many loans and the bank is not what tells a user's own loans apart. Asked for even
   * on an imported loan: a calculation knows the amount and the rate, not what this loan is
   * called.
   */
  title: string;
  lender: string;
  loanType: LoanType;
  /**
   * Integer paise. `null` on an imported loan, which reads its figures from
   * `loanCalculationId` instead of storing a copy that goes stale.
   */
  principal: number | null;
  /** A percentage, 0-100. Not money. `null` on an imported loan. */
  interestRate: number | null;
  interestType: InterestType;
  /**
   * `YYYY-MM-DD`. Stored even on an imported loan, because the API indexes and
   * date-filters on it. It always agrees with the calculation's own start month.
   */
  startDate: string;
  /** `YYYY-MM-DD`. `null` on an imported loan; a calculation can end before its tenure. */
  endDate: string | null;
  /** Integer paise. Absent for non-EMI and imported loans. */
  emiAmount: number | null;
  emiDay: number | null;
  tenureMonths: number | null;
  /**
   * Sanctioned but not yet advanced, in paise. `null` when the user has not said.
   *
   * Informational only, and stored for imported loans exactly as for recorded ones: no
   * calculation can answer it, so there is nothing to derive it from.
   */
  undisbursedAmount: number | null;
  /**
   * The saved calculation this loan was imported from, or `null` for a loan the user
   * recorded. The only place an imported loan's figures live.
   */
  loanCalculationId: string | null;
  status: LoanStatus;
  purpose: string | null;
  reference: string | null;
  notes: string | null;
};

export type Income = RecordTimestamps & {
  source: string;
  /**
   * Integer paise, or `null` on an income imported from a saved income-tax scenario.
   *
   * An imported income's amount is read from that scenario rather than stored, so the two can
   * never disagree once a budget is revised. A client that reads a `null` here must resolve it
   * from `incomeTaxCalculationId` — and must never read it as zero.
   */
  amount: number | null;
  /** `YYYY-MM-DD`. */
  date: string;
  category: IncomeCategory;
  paymentMode: PaymentMode;
  payer: string | null;
  destination: Destination;
  reason: string | null;
  reference: string | null;
  /**
   * Integer paise. TDS withheld, or `null` on an imported income — the tax belongs to the
   * scenario, which in turn reads it from the site's budget config.
   */
  taxPaid: number | null;
  /**
   * The saved income-tax scenario this entry was imported from, or `null` for one recorded by
   * hand. The presence of this is what makes the two fields above resolve from elsewhere.
   */
  incomeTaxCalculationId: string | null;
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency | null;
  notes: string | null;
};

export type Expense = RecordTimestamps & {
  title: string;
  /**
   * Integer paise, or `null` on an expense linked to a loan.
   *
   * A linked expense's amount is read from that loan's amortisation **at this expense's own
   * month** — not at the current month, and never re-read at display time from whatever the
   * loan says now. A client that reads a null here must resolve it from `loanId` and `date`.
   */
  amount: number | null;
  /**
   * Which month this expense belongs to. The anchor the amount is resolved at, and the one
   * thing about this payment the loan cannot know — which of its months were actually paid.
   */
  date: string;
  /** `null` on a linked expense, which is an `installment` by definition. */
  category: ExpenseCategory | null;
  /** Required when `category` is `installment`, and null otherwise. */
  installmentType: InstallmentType | null;
  /**
   * The loan this expense pays down, or `null` for one recorded by hand.
   *
   * The whole of a linked expense's figures live behind this: amount, category and kind are
   * all read from the loan, so there is exactly one source of truth for an instalment and it
   * is the loan's own amortisation.
   */
  loanId: string | null;
  paymentMode: PaymentMode;
  destination: Destination;
  merchant: string | null;
  reason: string | null;
  reference: string | null;
  isEssential: boolean;
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency | null;
  notes: string | null;
};

export type Goal = RecordTimestamps & {
  title: string;
  description: string | null;
  /** Integer paise. */
  targetAmount: number;
  /** Integer paise. May exceed `targetAmount`. */
  currentAmount: number;
  /** `YYYY-MM-DD`. */
  targetDate: string;
  /** Integer paise. */
  monthlyContribution: number | null;
  category: GoalCategory;
  priority: GoalPriority;
  status: GoalStatus;
  notes: string | null;
  /**
   * Server-computed and read-only. Sending any of the three is a validation
   * error, so none of them appear in the create or update payloads.
   */
  progressPercent: number;
  remainingAmount: number;
  daysRemaining: number;
};

export type ListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

/** Every list response returns `items` plus `meta`, never a bare array. */
export type ListResponse<TItem> = {
  items: TItem[];
  meta: ListMeta;
};

export type SortDirection = "asc" | "desc";

/** Query parameters accepted by every list endpoint. Unknown ones are ignored. */
export type ListQuery = {
  page?: number;
  limit?: number;
  /** A `-` prefix already encodes the direction. */
  sort?: string;
  order?: SortDirection;
  /** `YYYY-MM-DD`, inclusive lower bound on the resource's primary date. */
  from?: string;
  /** `YYYY-MM-DD`, inclusive upper bound. */
  to?: string;
  /**
   * Restrict to these record ids. Sent as repeated query keys, which every list route
   * accepts alongside the comma-separated form.
   *
   * Needed because one screen can point at a different record per row — an expense's linked
   * loan, say — and resolving those one request at a time puts a round trip between the user
   * and every figure on screen.
   */
  ids?: string[];
  /** Repeatable type filter, sent as repeated query keys. */
  type?: string[];
  search?: string;
  includeDeleted?: boolean;
  /** Repeatable filters are sent as repeated query keys, not arrays. */
  category?: string[];
  status?: string[];
  loanType?: string[];
  paymentMode?: string[];
  priority?: string[];
  isRecurring?: boolean;
  isEssential?: boolean;
};

export type LoansSummary = {
  totalLoans: number;
  activeLoans: number;
  closedLoans: number;
  totalPrincipal: number;
  totalEmi: number;
  /**
   * Loans imported from a calculation. They store neither principal nor EMI, so they add
   * nothing to the two totals above; this says how many were left out of them.
   */
  importedLoans?: number;
  byLoanType: { loanType: LoanType; count: number; totalPrincipal: number }[];
  asOf: string;
};

export type IncomeGroup = {
  category: IncomeCategory;
  count: number;
  totalAmount: number;
};

export type PaymentModeGroup = {
  paymentMode: PaymentMode;
  count: number;
  totalAmount: number;
};

export type ExpenseGroup = {
  category: ExpenseCategory;
  count: number;
  totalAmount: number;
};

export type IncomesSummary = {
  totalIncome: number;
  recordCount: number;
  averageIncome: number;
  byCategory: IncomeGroup[];
  byPaymentMode: PaymentModeGroup[];
  asOf: string;
};

export type ExpensesSummary = {
  totalExpense: number;
  recordCount: number;
  averageExpense: number;
  essentialTotal: number;
  nonEssentialTotal: number;
  byCategory: ExpenseGroup[];
  byPaymentMode: PaymentModeGroup[];
  asOf: string;
};

export type GoalsSummary = {
  totalGoals: number;
  activeGoals: number;
  achievedGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  totalRemainingAmount: number;
  overallProgressPercent: number;
  byCategory: {
    category: GoalCategory;
    count: number;
    totalTargetAmount: number;
    totalCurrentAmount: number;
  }[];
  asOf: string;
};

/** A field present in a create payload. Absent keys are not sent at all. */
export type CreateLoanPayload = {
  title: string;
  lender: string;
  loanType: LoanType;
  interestType: InterestType;
  /** Always sent, and always from the calculation on an import. */
  startDate: string;
  /**
   * Import from a saved calculation. When present, `principal`, `interestRate`,
   * `endDate`, `emiAmount` and `tenureMonths` must be omitted — the API refuses them,
   * because two sources of truth for one loan is worse than none.
   */
  loanCalculationId?: string | null;
  principal?: number;
  interestRate?: number;
  endDate?: string;
  emiAmount?: number;
  emiDay?: number;
  tenureMonths?: number;
  /**
   * Sanctioned but not yet advanced. Never derived from a calculation and never summed
   * into anything — it is the user's own note about how much of the loan is still to come.
   */
  undisbursedAmount?: number;
  status?: LoanStatus;
  purpose?: string;
  reference?: string;
  notes?: string;
};

export type UpdateLoanPayload = Partial<CreateLoanPayload>;

export type CreateIncomePayload = {
  source: string;
  amount: number;
  date: string;
  category: IncomeCategory;
  paymentMode: PaymentMode;
  payer?: string;
  destination?: Destination;
  reason?: string;
  reference?: string;
  taxPaid?: number;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  notes?: string;
};

export type UpdateIncomePayload = Partial<CreateIncomePayload>;

export type CreateExpensePayload = {
  title: string;
  /**
   * Omitted on an expense linked to a loan, whose amount is read from that loan's
   * amortisation. Sending one alongside `loanId` is refused by the API.
   */
  amount?: number;
  date: string;
  /** Omitted on a linked expense, which is an `installment` by definition. */
  category?: ExpenseCategory;
  installmentType?: InstallmentType;
  /**
   * The loan this is an instalment of. With it, the three fields above are derived rather than
   * stored, and this record becomes a link plus a month plus the user's own labelling.
   */
  loanId?: string | null;
  paymentMode: PaymentMode;
  destination?: Destination;
  merchant?: string;
  reason?: string;
  reference?: string;
  isEssential?: boolean;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  notes?: string;
};

export type UpdateExpensePayload = Partial<CreateExpensePayload>;

export type CreateGoalPayload = {
  title: string;
  targetAmount: number;
  targetDate: string;
  currentAmount?: number;
  monthlyContribution?: number;
  category?: GoalCategory;
  priority?: GoalPriority;
  status?: GoalStatus;
  description?: string;
  notes?: string;
};

export type UpdateGoalPayload = Partial<CreateGoalPayload>;