import { CALCULATIONS_LIST_LIMIT } from "@/constants/calculations";
import {
  createCalculation,
  getCalculationsByIds,
  listCalculations,
} from "@/services/loan/calculations";
import type { AuthedRequest } from "@/services/finance/records";
import type { CreateLoanCalculationPayload } from "@/types/Loan/CalculationTypes";
import { CalculationType } from "@/types/Loan/CalculationTypes";
import { CalculationPrepaymentInterval } from "@/types/Loan/CalculationTypes";

/** Records what the service asked the network for, so the shape can be asserted. */
const createRequest = () => {
  const calls: { path: string; method?: string; body?: unknown }[] = [];

  const request = (async <TData,>(
    path: string,
    options?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown }
  ): Promise<TData> => {
    calls.push({ path, method: options?.method, body: options?.body });
    return { items: [], meta: {} } as TData;
  }) as AuthedRequest;

  return { request, calls };
};

const payload: CreateLoanCalculationPayload = {
  name: "HDB plan with top-up",
  description: "Rate hike in year 4, top-up in year 6.",
  calculationType: CalculationType.HOME,
  currency: "INR",
  loan: {
    loanAmount: 500_000_000,
    rateOfInterest: 8,
    tenure: { years: 20, months: 0 },
    startMonth: "2026-10",
  },
  prepayments: [
    {
      amount: 10_000_000,
      startMonth: "2027-04",
      interval: CalculationPrepaymentInterval.ONE_TIME,
    },
  ],
  monthChanges: [{ monthIndex: 36, rateOfInterest: 8.5 }],
};

describe("loan calculations service", () => {
  describe("list", () => {
    it("reads the collection, newest first, with no explicit method", async () => {
      const { request, calls } = createRequest();

      await listCalculations(request);

      expect(calls[0].path).toBe(
        `/loan-calculations?limit=${CALCULATIONS_LIST_LIMIT}&sort=-createdAt`
      );
      expect(calls[0].method).toBeUndefined();
    });

    it("asks for a page big enough to fill a control that has no pager", async () => {
      const { request, calls } = createRequest();

      await listCalculations(request);

      expect(calls[0].path).toContain(`limit=${CALCULATIONS_LIST_LIMIT}`);
    });
  });

  describe("create", () => {
    it("posts the payload to the collection", async () => {
      const { request, calls } = createRequest();

      await createCalculation(request, payload);

      expect(calls[0].path).toBe("/loan-calculations");
      expect(calls[0].method).toBe("POST");
    });

    it("sends the payload body unaltered", async () => {
      const { request, calls } = createRequest();

      await createCalculation(request, payload);

      expect(calls[0].body).toEqual(payload);
    });
  });

  describe("getCalculationsByIds", () => {
    const saved = (id: string) => ({
      id,
      name: `Plan ${id}`,
      description: null,
      calculationType: CalculationType.HOME,
      currency: "INR" as const,
      loan: {
        loanAmount: 1000,
        rateOfInterest: 8,
        tenure: { years: 1, months: 0 },
        startMonth: "2026-10",
      },
      prepayments: [],
      monthChanges: [],
      createdAt: "2026-10-07T08:13:49.103Z",
      updatedAt: "2026-10-07T08:13:49.103Z",
    });

    const requestReturning = (items: unknown[]) => {
      const calls: string[] = [];
      const request = (async <TData,>(path: string): Promise<TData> => {
        calls.push(path);
        return { items, meta: {} } as TData;
      }) as AuthedRequest;
      return { request, calls };
    };

    it("asks for every id in one request", async () => {
      const { request, calls } = requestReturning([saved("a"), saved("b")]);

      await getCalculationsByIds(request, ["a", "b"]);

      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain("ids=a%2Cb");
    });

    it("keyed by id, so a caller can look one up without searching", async () => {
      const { request } = requestReturning([saved("a"), saved("b")]);

      const result = await getCalculationsByIds(request, ["a", "b"]);

      expect(result.a.name).toBe("Plan a");
      expect(result.b.name).toBe("Plan b");
    });

    it("de-duplicates, so a list importing one scenario twice asks once", async () => {
      const { request, calls } = requestReturning([saved("a")]);

      await getCalculationsByIds(request, ["a", "a", "a"]);

      expect(calls[0]).toContain("ids=a");
      expect(calls[0]).not.toContain("a%2Ca");
    });

    it("makes no request at all for an empty list", async () => {
      const { request, calls } = requestReturning([]);

      const result = await getCalculationsByIds(request, []);

      // Nothing to resolve, so there is nothing to ask for.
      expect(calls).toHaveLength(0);
      expect(result).toEqual({});
    });

    it("ignores blank ids rather than asking for an empty one", async () => {
      const { request, calls } = requestReturning([saved("a")]);

      const result = await getCalculationsByIds(request, ["", "a"]);

      expect(Object.keys(result)).toEqual(["a"]);
      expect(calls[0]).toContain("ids=a&");
    });

    it("asks for a page as large as the request, so nothing is cut off", async () => {
      const { request, calls } = requestReturning([saved("a"), saved("b")]);

      await getCalculationsByIds(request, ["a", "b"]);

      expect(calls[0]).toContain("limit=2");
    });
  });
});