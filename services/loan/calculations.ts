import { CALCULATIONS_LIST_LIMIT, CALCULATIONS_PATH } from "@/constants/calculations";
import type { AuthedRequest } from "@/services/finance/records";
import type {
    CalculationsList,
    CreateLoanCalculationPayload,
    CreateLoanCalculationResponse,
} from "@/types/Loan/CalculationTypes";

/**
 * Every saved calculation, newest first, in one request.
 *
 * `limit` is pinned rather than left to the server default because the consumer
 * is a dropdown with no pager: it would otherwise render the first page and
 * silently hide everything the user saved after it.
 */
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";

export const listCalculations = (request: AuthedRequest): Promise<CalculationsList> =>
    request<CalculationsList>(
        `${CALCULATIONS_PATH}?limit=${CALCULATIONS_LIST_LIMIT}&sort=-createdAt`
    );

/**
 * Several scenarios by id, in one request.
 *
 * A list of loans can import from several scenarios — one per loan — and resolving them one
 * request at a time turns a single screen into N round trips before it can draw. The ids are
 * de-duplicated here rather than on the wire, so a list that imports the same scenario twice
 * asks once.
 *
 * An empty list resolves to an empty result without a request: there is nothing to resolve,
 * and asking would only produce a guaranteed success.
 */
export const getCalculationsByIds = async (
    request: AuthedRequest,
    ids: string[]
): Promise<Record<string, SavedLoanCalculation>> => {
    const unique = [...new Set(ids.filter((id) => id.length > 0))];

    if (unique.length === 0) {
        return {};
    }

    const { items } = await request<CalculationsList>(
        `${CALCULATIONS_PATH}?ids=${encodeURIComponent(unique.join(","))}&limit=${unique.length}`
    );

    return Object.fromEntries(items.map((item) => [item.id, item]));
};

export const createCalculation = (
    request: AuthedRequest,
    payload: CreateLoanCalculationPayload
): Promise<CreateLoanCalculationResponse> =>
    request<CreateLoanCalculationResponse>(CALCULATIONS_PATH, {
        method: "POST",
        body: payload,
    });