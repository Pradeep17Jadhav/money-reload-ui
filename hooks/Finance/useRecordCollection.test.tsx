import { act, renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/authContext";
import { useRecordCollection } from "@/hooks/Finance/useRecordCollection";
import { useRecordSummary } from "@/hooks/Finance/useRecordSummary";
import { AuthErrorCode } from "@/types/AuthTypes";
import type { ListMeta, ListQuery, ListResponse } from "@/types/FinanceTypes";
import { createApiError } from "@/tests/factories/authFactories";

jest.mock("@/contexts/authContext", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as unknown as jest.Mock;

const authorisedRequest = jest.fn();
const removeRecord = jest.fn();

type TestItem = { id: string; amount: number };

const listFn = jest.fn<Promise<ListResponse<TestItem>>, [unknown, ListQuery]>();
const summaryFn = jest.fn();

const META: ListMeta = {
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const item = { id: "a", amount: 100 };

/**
 * Wired exactly as the four record pages wire it: the summary takes both the
 * collection's query and its reload token.
 */
const useScreen = () => {
  const collection = useRecordCollection<TestItem>({ list: listFn, remove: removeRecord });
  const summary = useRecordSummary(summaryFn, collection.query, collection.reloadToken);

  return { collection, summary };
};

describe("record list and summary stay in step", () => {
  beforeEach(() => {
    authorisedRequest.mockReset();
    removeRecord.mockReset();
    listFn.mockReset();
    summaryFn.mockReset();

    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { firstName: "Probe", lastName: "One" },
      isSignedIn: true,
      sessionRestoreMessage: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      authorisedRequest,
    });
  });

  describe("immediate updates", () => {
    it("re-reads the totals whenever the rows are re-read", async () => {
      listFn.mockResolvedValue({ items: [item], meta: META });
      summaryFn.mockResolvedValue({ totalIncome: 100 });

      const { result } = renderHook(useScreen);

      await waitFor(() => {
        expect(listFn).toHaveBeenCalledTimes(1);
        expect(summaryFn).toHaveBeenCalledTimes(1);
      });

      // The bug this guards: the summary had its own reload token, so a create,
      // edit or delete refreshed the table while the tiles kept the old totals.
      act(() => {
        result.current.collection.refetch();
      });

      await waitFor(() => {
        expect(listFn).toHaveBeenCalledTimes(2);
        expect(summaryFn).toHaveBeenCalledTimes(2);
      });
    });

    it("updates both after a delete", async () => {
      listFn.mockResolvedValue({ items: [item], meta: META });
      summaryFn.mockResolvedValue({ totalIncome: 100 });
      removeRecord.mockResolvedValue(undefined);

      const { result } = renderHook(useScreen);

      await waitFor(() => expect(listFn).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.collection.remove("a");
      });

      expect(removeRecord).toHaveBeenCalledWith(authorisedRequest, "a");

      await waitFor(() => {
        expect(listFn).toHaveBeenCalledTimes(2);
        expect(summaryFn).toHaveBeenCalledTimes(2);
      });
    });

    it("gives the summary the same query the table is showing", async () => {
      listFn.mockResolvedValue({ items: [], meta: META });
      summaryFn.mockResolvedValue({});

      const { result } = renderHook(useScreen);

      await waitFor(() => expect(summaryFn).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.collection.updateQuery((current) => ({ ...current, search: "salary" }));
      });

      // A total that did not describe the rows on screen would be worse than none.
      await waitFor(() => {
        expect(summaryFn).toHaveBeenLastCalledWith(
          authorisedRequest,
          expect.objectContaining({ search: "salary" })
        );
      });
    });
  });

  describe("paging", () => {
    beforeEach(() => {
      listFn.mockResolvedValue({ items: [], meta: META });
    });

    it("returns to page one when a filter narrows the result", async () => {
      const { result } = renderHook(useScreen);

      await waitFor(() => expect(result.current.collection.isLoading).toBe(false));

      act(() => {
        result.current.collection.setPage(3);
      });
      expect(result.current.collection.query.page).toBe(3);

      act(() => {
        result.current.collection.updateQuery((current) => ({ ...current, search: "rent" }));
      });

      expect(result.current.collection.query.page).toBe(1);
      expect(result.current.collection.query.search).toBe("rent");
    });

    it("keeps the page when only the page changes", async () => {
      const { result } = renderHook(useScreen);

      await waitFor(() => expect(result.current.collection.isLoading).toBe(false));

      act(() => {
        result.current.collection.setPage(2);
      });

      expect(result.current.collection.query.page).toBe(2);
    });

    it("clears filters back to the defaults", async () => {
      const { result } = renderHook(useScreen);

      await waitFor(() => expect(result.current.collection.isLoading).toBe(false));

      act(() => {
        result.current.collection.updateQuery((current) => ({ ...current, search: "rent" }));
      });
      act(() => {
        result.current.collection.resetFilters();
      });

      expect(result.current.collection.query.search).toBeUndefined();
      expect(result.current.collection.query.page).toBe(1);
    });
  });

  describe("failures", () => {
    it("shows a banner rather than an empty table when the list fails", async () => {
      listFn.mockRejectedValue(createApiError(AuthErrorCode.DATABASE_UNAVAILABLE));

      // Rendered on its own here, so the hook result is the collection itself.
      const { result } = renderHook(() =>
        useRecordCollection<TestItem>({ list: listFn, remove: removeRecord })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.items).toEqual([]);
      expect(result.current.error).toMatch(/briefly unavailable/i);
    });

    it("keeps the rows usable when only the totals fail", async () => {
      listFn.mockResolvedValue({ items: [item], meta: META });
      summaryFn.mockRejectedValue(createApiError(AuthErrorCode.NETWORK_ERROR));

      const { result } = renderHook(useScreen);

      await waitFor(() => expect(result.current.summary.error).not.toBeNull());

      expect(result.current.summary.summary).toBeNull();
      expect(result.current.collection.items).toHaveLength(1);
    });
  });
});