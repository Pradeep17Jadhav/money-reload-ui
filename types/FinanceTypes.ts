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
  lender: string;
  loanType: LoanType;
  /** Integer paise. */
  principal: number;
  /** A percentage, 0-100. Not money: never divided by 100. */
  interestRate: number;
  interestType: InterestType;
  /** `YYYY-MM-DD`. */
  startDate: string;
  /** `YYYY-MM-DD`. */
  endDate: string;
  /** Integer paise. Absent for non-EMI loans. */
  emiAmount: number | null;
  emiDay: number | null;
  tenureMonths: number | null;
  status: LoanStatus;
  purpose: string | null;
  reference: string | null;
  notes: string | null;
};

export type Income = RecordTimestamps & {
  source: string;
  /** Integer paise. */
  amount: number;
  /** `YYYY-MM-DD`. */
  date: string;
  category: IncomeCategory;
  paymentMode: PaymentMode;
  payer: string | null;
  destination: Destination;
  reason: string | null;
  reference: string | null;
  /** Integer paise. TDS withheld. */
  taxPaid: number | null;
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency | null;
  notes: string | null;
};

export type Expense = RecordTimestamps & {
  title: string;
  /** Integer paise. */
  amount: number;
  /** `YYYY-MM-DD`. */
  date: string;
  category: ExpenseCategory;
  /** Required when `category` is `installment`, and null otherwise. */
  installmentType: InstallmentType | null;
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
  lender: string;
  loanType: LoanType;
  principal: number;
  interestRate: number;
  interestType: InterestType;
  startDate: string;
  endDate: string;
  emiAmount?: number;
  emiDay?: number;
  tenureMonths?: number;
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
  amount: number;
  date: string;
  category: ExpenseCategory;
  installmentType?: InstallmentType;
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