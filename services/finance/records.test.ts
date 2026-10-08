import {
  compactPayload,
  createGoal,
  deleteGoal,
  listExpenses,
  listGoals,
  listLoans,
  updateExpense,
} from "@/services/finance/records";
import type { AuthedRequest } from "@/services/finance/records";

/** Records what the page asked the network for, so the shape can be asserted. */
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

describe("finance records service", () => {
  describe("list", () => {
    it("reads the array from items, not a resource-named key", async () => {
      const { request, calls } = createRequest();

      await listLoans(request);

      expect(calls[0].path).toBe("/loans");
      expect(calls[0].method).toBeUndefined();
    });

    it("asks for specific ids on the collection path", async () => {
      const { request, calls } = createRequest();

      /*
       * Regression guard. A caller once assembled this URL by hand and dropped the leading
       * slash, so every request resolved against the wrong base and the expenses table lost
       * the amount and category of every linked expense — with no error surfaced anywhere.
       * The path belongs to `listRecords` alone; nothing else may spell it out.
       */
      await listLoans(request, { ids: ["a", "b"], limit: 2 });

      expect(calls[0].path).toBe("/loans?ids=a&ids=b&limit=2");
    });

    it("leaves the ids out entirely when none are asked for", async () => {
      const { request, calls } = createRequest();

      await listLoans(request, { ids: [], limit: 20 });

      // An empty filter would ask for loans whose id is in no set, which is not "all of them"
      // to the reader and is not what the caller meant.
      expect(calls[0].path).toBe("/loans?limit=20");
    });

    it("uses the plural path each resource is mounted on", async () => {
      const { request, calls } = createRequest();

      await listGoals(request);
      await listExpenses(request);

      expect(calls[0].path).toBe("/goals");
      expect(calls[1].path).toBe("/expenses");
    });

    it("sends repeatable filters as repeated keys, not an array", async () => {
      const { request, calls } = createRequest();

      await listLoans(request, { status: ["active", "overdue"], loanType: ["home"] });

      expect(calls[0].path).toBe("/loans?status=active&status=overdue&loanType=home");
    });

    it("omits absent filters rather than sending them empty", async () => {
      const { request, calls } = createRequest();

      await listLoans(request, { page: 1, limit: 20, search: undefined, status: undefined });

      expect(calls[0].path).toBe("/loans?page=1&limit=20");
    });

    it("drops an empty selection instead of sending a blank key", async () => {
      const { request, calls } = createRequest();

      await listLoans(request, { status: [] });

      expect(calls[0].path).toBe("/loans");
    });

    it("sends booleans and the soft-delete flag", async () => {
      const { request, calls } = createRequest();

      await listExpenses(request, { includeDeleted: true, isEssential: false });

      expect(calls[0].path).toContain("includeDeleted=true");
      expect(calls[0].path).toContain("isEssential=false");
    });
  });

  describe("write", () => {
    it("posts to the collection root", async () => {
      const { request, calls } = createRequest();

      await createGoal(request, { title: "Emergency fund" });

      expect(calls[0]).toMatchObject({ path: "/goals", method: "POST" });
    });

    it("strips undefined so the strict body carries no phantom keys", async () => {
      const { request, calls } = createRequest();

      await createGoal(request, {
        title: "Emergency fund",
        targetAmount: 30000000,
        targetDate: "2027-06-30",
        currentAmount: undefined,
        monthlyContribution: undefined,
      });

      expect(Object.keys(calls[0].body as object)).toEqual([
        "title",
        "targetAmount",
        "targetDate",
      ]);
    });

    it("patches one record by id", async () => {
      const { request, calls } = createRequest();

      await updateExpense(request, "abc123", { amount: 1000 });

      expect(calls[0]).toEqual({
        path: "/expenses/abc123",
        method: "PATCH",
        body: { amount: 1000 },
      });
    });

    it("deletes by id with a DELETE, expecting an empty body back", async () => {
      const { request, calls } = createRequest();

      await deleteGoal(request, "abc123");

      expect(calls[0]).toEqual({ path: "/goals/abc123", method: "DELETE", body: undefined });
    });
  });

  it("keeps a zero, which is a real value and not an absent field", () => {
    expect(compactPayload({ a: 0, b: undefined, c: false })).toEqual({ a: 0, c: false });
  });
});