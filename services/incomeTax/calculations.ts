import type { AuthedRequest } from "@/services/finance/records";
import type {
  CreateIncomeTaxCalculationPayload,
  CreateIncomeTaxCalculationResponse,
  IncomeTaxCalculationResponse,
  IncomeTaxCalculationsList,
  SavedIncomeTaxCalculation,
} from "@/types/IncomeTax/CalculationTypes";
import { withAdditionalIncome } from "@/types/IncomeTax/CalculationTypes";

/**
 * The income-tax calculator's own scenario store, kept apart from the loan one.
 *
 * A different endpoint and a different payload, so sharing the module would only mean two
 * branches through every call — and the naming would then have to say which. `/income-tax-calculations`
 * is the server's path.
 */
const INCOME_TAX_CALCULATIONS_PATH = "/income-tax-calculations";

/**
 * The list is a dropdown with no pager, so `limit` is pinned rather than left to the server
 * default — otherwise it would render the first page and silently hide everything the user saved
 * after it.
 */
const LIST_LIMIT = 100;

/**
 * Every saved scenario, newest first, in one request.
 */
export const listIncomeTaxCalculations = async (
  request: AuthedRequest
): Promise<IncomeTaxCalculationsList> => {
  const { items, meta } = await request<{
    items: IncomeTaxCalculationResponse[];
    meta: IncomeTaxCalculationsList["meta"];
  }>(`${INCOME_TAX_CALCULATIONS_PATH}?limit=${LIST_LIMIT}&sort=-createdAt`);

  return { items: items.map(withAdditionalIncome), meta };
};

/**
 * Several scenarios by id, in one request.
 *
 * An income list can import from several scenarios — one per row — and resolving them one request
 * at a time turns a single screen into N round trips before it can draw. De-duplicated here
 * rather than on the wire, so a list that points at the same scenario twice asks once.
 *
 * An empty list resolves without a request: there is nothing to resolve, and asking would only
 * produce a guaranteed success.
 */
export const getIncomeTaxCalculationsByIds = async (
  request: AuthedRequest,
  ids: string[]
): Promise<Record<string, SavedIncomeTaxCalculation>> => {
  const unique = [...new Set(ids.filter((id) => id.length > 0))];

  if (unique.length === 0) {
    return {};
  }

  const { items } = await request<{
    items: IncomeTaxCalculationResponse[];
    meta: unknown;
  }>(
    `${INCOME_TAX_CALCULATIONS_PATH}?ids=${encodeURIComponent(unique.join(","))}&limit=${unique.length}`
  );

  return Object.fromEntries(
    items.map((item) => {
      const calculation = withAdditionalIncome(item);

      return [calculation.id, calculation];
    })
  );
};

export const createIncomeTaxCalculation = async (
  request: AuthedRequest,
  payload: CreateIncomeTaxCalculationPayload
): Promise<CreateIncomeTaxCalculationResponse> => {
  const response = await request<{
    calculation: IncomeTaxCalculationResponse;
  }>(INCOME_TAX_CALCULATIONS_PATH, {
    method: "POST",
    body: payload,
  });

  return { calculation: withAdditionalIncome(response.calculation) };
};