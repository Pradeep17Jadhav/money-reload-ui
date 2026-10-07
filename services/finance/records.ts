import type { AuthRequestMethod } from "@/services/apiClient.types";
import type {
  Expense,
  ExpensesSummary,
  Goal,
  GoalsSummary,
  Income,
  IncomesSummary,
  ListQuery,
  ListResponse,
  Loan,
  LoansSummary,
} from "@/types/FinanceTypes";

/**
 * The four resources differ only in their path, their single-record key and
 * their field list, so they share one set of transport functions.
 *
 * The request function is injected rather than imported, which keeps this layer
 * free of React and makes it trivially testable. `AuthContext` supplies an
 * implementation that attaches the access token, refreshes once on expiry and
 * signs the user out when the session is gone.
 */
export type AuthedRequest = <TData>(
  path: string,
  options?: { method?: AuthRequestMethod; body?: unknown }
) => Promise<TData>;

/**
 * Path segment per resource, each including the leading slash. Note `/incomes`
 * and `/expenses` are plural, and the summary route hangs off the collection
 * path rather than being a separate root.
 */
export const RECORD_PATHS = {
  loans: "/loans",
  incomes: "/incomes",
  expenses: "/expenses",
  goals: "/goals",
} as const;

export type ResourceKey = keyof typeof RECORD_PATHS;

const toSearchParams = (query: ListQuery = {}): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    // Repeatable filters are sent as repeated keys: `category=a&category=b`.
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
      continue;
    }

    params.append(key, String(value));
  }

  const search = params.toString();
  return search ? `?${search}` : "";
};

export const listRecords = async <TItem>(
  request: AuthedRequest,
  resource: ResourceKey,
  query: ListQuery = {}
): Promise<ListResponse<TItem>> => {
  // Every list response nests the array under `items`, never under a
  // resource-named key. An empty result is `items: []`, never null.
  return request<ListResponse<TItem>>(`${RECORD_PATHS[resource]}${toSearchParams(query)}`);
};

/** Single endpoints use a resource-named key, which differs from `items` above. */
export const getSummary = async <TSummary>(
  request: AuthedRequest,
  resource: ResourceKey,
  query: ListQuery = {}
): Promise<TSummary> => request<TSummary>(`${RECORD_PATHS[resource]}/summary${toSearchParams(query)}`);

export const getRecord = async <TRecord>(
  request: AuthedRequest,
  resource: ResourceKey,
  id: string
): Promise<TRecord> => request<TRecord>(`${RECORD_PATHS[resource]}/${id}`);

export const createRecord = async <TRecord, TPayload>(
  request: AuthedRequest,
  resource: ResourceKey,
  payload: TPayload
): Promise<TRecord> =>
  request<TRecord>(RECORD_PATHS[resource], { method: "POST", body: payload });

/**
 * Partial update. The payload must carry only the fields that changed: omitted
 * fields are left untouched, and any key outside the contract is rejected.
 */
export const updateRecord = async <TRecord, TPayload>(
  request: AuthedRequest,
  resource: ResourceKey,
  id: string,
  payload: TPayload
): Promise<TRecord> =>
  request<TRecord>(`${RECORD_PATHS[resource]}/${id}`, { method: "PATCH", body: payload });

/** Soft delete. Returns 204 with an empty body. */
export const removeRecord = async (
  request: AuthedRequest,
  resource: ResourceKey,
  id: string
): Promise<void> => {
  await request<void>(`${RECORD_PATHS[resource]}/${id}`, { method: "DELETE" });
};

/**
 * Strips `undefined` so an absent optional is never sent as a key at all. The
 * request bodies are strict, so a key the contract does not list is a rejection
 * rather than something to ignore.
 */
export const compactPayload = <TPayload extends object>(payload: TPayload): TPayload =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as TPayload;

/**
 * The create and update helpers take the payload as the generic form built it:
 * a `Record` whose keys are exactly the fields the user filled in.
 *
 * `CreateLoanPayload` and friends document the exact shape the API expects and
 * are what the field configs are validated against. Type safety at this boundary
 * is enforced by `validateForm` before submitting and by the API's strict
 * validation afterwards, not by a cast.
 */
export const listLoans = (request: AuthedRequest, query?: ListQuery) =>
  listRecords<Loan>(request, "loans", query);

export const getLoansSummary = (request: AuthedRequest, query?: ListQuery) =>
  getSummary<LoansSummary>(request, "loans", query);

export const createLoan = (request: AuthedRequest, payload: Record<string, unknown>) =>
  createRecord<Loan, Record<string, unknown>>(request, "loans", compactPayload(payload));

export const updateLoan = (request: AuthedRequest, id: string, payload: Record<string, unknown>) =>
  updateRecord<Loan, Record<string, unknown>>(request, "loans", id, compactPayload(payload));

export const deleteLoan = (request: AuthedRequest, id: string) =>
  removeRecord(request, "loans", id);

export const listIncomes = (request: AuthedRequest, query?: ListQuery) =>
  listRecords<Income>(request, "incomes", query);

export const getIncomesSummary = (request: AuthedRequest, query?: ListQuery) =>
  getSummary<IncomesSummary>(request, "incomes", query);

export const createIncome = (request: AuthedRequest, payload: Record<string, unknown>) =>
  createRecord<Income, Record<string, unknown>>(request, "incomes", compactPayload(payload));

export const updateIncome = (request: AuthedRequest, id: string, payload: Record<string, unknown>) =>
  updateRecord<Income, Record<string, unknown>>(request, "incomes", id, compactPayload(payload));

export const deleteIncome = (request: AuthedRequest, id: string) =>
  removeRecord(request, "incomes", id);

export const listExpenses = (request: AuthedRequest, query?: ListQuery) =>
  listRecords<Expense>(request, "expenses", query);

export const getExpensesSummary = (request: AuthedRequest, query?: ListQuery) =>
  getSummary<ExpensesSummary>(request, "expenses", query);

export const createExpense = (request: AuthedRequest, payload: Record<string, unknown>) =>
  createRecord<Expense, Record<string, unknown>>(request, "expenses", compactPayload(payload));

export const updateExpense = (request: AuthedRequest, id: string, payload: Record<string, unknown>) =>
  updateRecord<Expense, Record<string, unknown>>(request, "expenses", id, compactPayload(payload));

export const deleteExpense = (request: AuthedRequest, id: string) =>
  removeRecord(request, "expenses", id);

export const listGoals = (request: AuthedRequest, query?: ListQuery) =>
  listRecords<Goal>(request, "goals", query);

export const getGoalsSummary = (request: AuthedRequest, query?: ListQuery) =>
  getSummary<GoalsSummary>(request, "goals", query);

export const createGoal = (request: AuthedRequest, payload: Record<string, unknown>) =>
  createRecord<Goal, Record<string, unknown>>(request, "goals", compactPayload(payload));

export const updateGoal = (request: AuthedRequest, id: string, payload: Record<string, unknown>) =>
  updateRecord<Goal, Record<string, unknown>>(request, "goals", id, compactPayload(payload));

export const deleteGoal = (request: AuthedRequest, id: string) =>
  removeRecord(request, "goals", id);