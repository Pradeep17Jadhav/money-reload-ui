import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/authContext";
import { useRecordCollection } from "@/hooks/Finance/useRecordCollection";
import type { AuthedRequest } from "@/services/finance/records";
import type { ListQuery, ListResponse } from "@/types/FinanceTypes";

jest.mock("@/contexts/authContext", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as unknown as jest.Mock;

/** Records what the list was asked for, so the filter can be asserted rather than inferred. */
const createRequest = () => {
  const queries: ListQuery[] = [];

  const list = jest.fn(
    async (_request: AuthedRequest, query: ListQuery): Promise<ListResponse<{ id: string }>> => {
      queries.push(query);

      return {
        items: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
      };
    }
  );

  return { list, queries };
};

const remove = jest.fn(async () => undefined);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ authorisedRequest: jest.fn() });
});

describe("a screen-owned filter", () => {
  it("goes into the query, so the server does the narrowing", async () => {
    const { list, queries } = createRequest();

    renderHook(() =>
      useRecordCollection({
        list: list as never,
        remove: remove as never,
        baseQuery: { type: ["fd"] },
      })
    );

    await waitFor(() => {
      expect(queries.length).toBeGreaterThan(0);
    });

    /*
     * Asserted on the request, not on a client-side filter, because the whole reason this
     * option exists is that filtering rows in the browser pages through everything and then
     * throws most of it away — making page two of a single-type table empty.
     */
    expect(queries[0]).toMatchObject({ type: ["fd"], limit: 20 });
  });

  it("takes effect when it changes, without waiting for a remount", async () => {
    const { list, queries } = createRequest();

    const { rerender } = renderHook(
      ({ baseQuery }: { baseQuery?: ListQuery | undefined }) =>
        useRecordCollection({
          list: list as never,
          remove: remove as never,
          baseQuery,
        }),
      { initialProps: { baseQuery: undefined as ListQuery | undefined } }
    );

    await waitFor(() => {
      expect(queries.length).toBeGreaterThan(0);
    });
    expect(queries[0]).not.toHaveProperty("type");

    // The screen points itself at a different set — here, a different kind of holding.
    rerender({ baseQuery: { type: ["sip"] } });

    await waitFor(() => {
      expect(queries.some((query) => query.type?.[0] === "sip")).toBe(true);
    });
  });

  it("lets the filter go again when the screen stops narrowing", async () => {
    /*
     * The "Everything" tab on /investments: no kind is chosen, so there is nothing to narrow to
     * and `baseQuery` becomes `undefined`.
     *
     * Layering the new filter over the old query cannot express that. Spreading `undefined`
     * contributes no keys, so `type` was left behind and the list went on returning the
     * previous tab's holdings under a heading that said it was showing everything.
     */
    const { list, queries } = createRequest();

    const { rerender } = renderHook(
      ({ baseQuery }: { baseQuery?: ListQuery | undefined }) =>
        useRecordCollection({
          list: list as never,
          remove: remove as never,
          baseQuery,
        }),
      { initialProps: { baseQuery: { type: ["fd"] } as ListQuery | undefined } }
    );

    await waitFor(() => {
      expect(queries.some((query) => query.type?.[0] === "fd")).toBe(true);
    });

    // Back to everything.
    rerender({ baseQuery: undefined });

    await waitFor(() => {
      expect(queries.length).toBeGreaterThan(1);
    });

    const last = queries[queries.length - 1];

    expect(last).not.toHaveProperty("type");
  });

  it("asks the server for everything, not just what one tab held", async () => {
    /*
     * Asserted on the request rather than on the rendered rows, because the point is that the
     * narrowing is undone at the source: filtering the rows already fetched would show
     * everything that was on screen, not everything the user has.
     */
    const { list, queries } = createRequest();

    const { rerender } = renderHook(
      ({ baseQuery }: { baseQuery?: ListQuery | undefined }) =>
        useRecordCollection({
          list: list as never,
          remove: remove as never,
          baseQuery,
        }),
      { initialProps: { baseQuery: { type: ["fd"] } as ListQuery | undefined } }
    );

    await waitFor(() => {
      expect(queries.length).toBeGreaterThan(0);
    });

    rerender({ baseQuery: { type: ["sip"] } });
    await waitFor(() => {
      expect(queries.some((query) => query.type?.[0] === "sip")).toBe(true);
    });

    rerender({ baseQuery: undefined });
    await waitFor(() => {
      expect(queries[queries.length - 1]).not.toHaveProperty("type");
    });

    // The sip filter went with it, rather than lingering as the next tab's subject.
    expect(queries[queries.length - 1].type).toBeUndefined();
  });

  it("keeps the user's own filters when the screen's filter is dropped", async () => {
    const { list } = createRequest();

    const { result, rerender } = renderHook(
      ({ baseQuery }: { baseQuery?: ListQuery | undefined }) =>
        useRecordCollection({
          list: list as never,
          remove: remove as never,
          baseQuery,
        }),
      { initialProps: { baseQuery: { type: ["fd"] } as ListQuery | undefined } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateQuery((current) => ({
        ...current,
        sort: "title",
        status: ["active"],
      }));
    });

    rerender({ baseQuery: undefined });

    // Dropping the tab's own narrowing is not a reason to forget what they asked for.
    await waitFor(() => {
      expect(result.current.query).not.toHaveProperty("type");
    });
    expect(result.current.query.sort).toBe("title");
    expect(result.current.query.status).toEqual(["active"]);
  });

  it("goes back to page one when the filter changes", async () => {
    const { list } = createRequest();

    const { result, rerender } = renderHook(
      ({ baseQuery }: { baseQuery?: ListQuery | undefined }) =>
        useRecordCollection({
          list: list as never,
          remove: remove as never,
          baseQuery,
        }),
      { initialProps: { baseQuery: undefined as ListQuery | undefined } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setPage(4);
    });
    expect(result.current.query.page).toBe(4);

    rerender({ baseQuery: { type: ["fd"] } });

    // Page four of the previous subject means nothing here.
    await waitFor(() => {
      expect(result.current.query.page).toBe(1);
    });
  });

  it("keeps the user's own sort and filters when the screen's filter changes", async () => {
    const { list } = createRequest();

    const { result, rerender } = renderHook(
      ({ baseQuery }: { baseQuery?: ListQuery | undefined }) =>
        useRecordCollection({
          list: list as never,
          remove: remove as never,
          baseQuery,
        }),
      { initialProps: { baseQuery: undefined as ListQuery | undefined } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateQuery((current) => ({
        ...current,
        sort: "title",
        status: ["active"],
      }));
    });

    rerender({ baseQuery: { type: ["fd"] } });

    // Switching what is on screen is not a reason to forget what they asked for.
    await waitFor(() => {
      expect(result.current.query.type).toEqual(["fd"]);
    });
    expect(result.current.query.sort).toBe("title");
    expect(result.current.query.status).toEqual(["active"]);
  });

  it("does not bounce the list when the filter object is rebuilt unchanged", async () => {
    const { list, queries } = createRequest();

    const { rerender } = renderHook(
      ({ baseQuery }: { baseQuery?: ListQuery | undefined }) =>
        useRecordCollection({
          list: list as never,
          remove: remove as never,
          baseQuery,
        }),
      { initialProps: { baseQuery: { type: ["fd"] } as ListQuery | undefined } }
    );

    await waitFor(() => {
      expect(queries.length).toBeGreaterThan(0);
    });
    const before = queries.length;

    // A fresh object literal with the same contents is not a change of subject.
    rerender({ baseQuery: { type: ["fd"] } });
    rerender({ baseQuery: { type: ["fd"] } });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(queries.length).toBe(before);
  });

  it("stays inside the screen's filter when the user clears theirs", async () => {
    const { list } = createRequest();

    const { result } = renderHook(() =>
      useRecordCollection({
        list: list as never,
        remove: remove as never,
        baseQuery: { type: ["fd"] },
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateQuery((current) => ({ ...current, category: ["x"] }));
      result.current.resetFilters();
    });

    // Clearing a filter should not also escape the tab the user is on.
    expect(result.current.query.type).toEqual(["fd"]);
    expect(result.current.query.category).toBeUndefined();
  });
});