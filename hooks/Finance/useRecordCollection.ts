"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { getAuthErrorCopy } from "@/helpers/apiErrors";
import type { AuthedRequest } from "@/services/finance/records";
import type { ListMeta, ListQuery, ListResponse } from "@/types/FinanceTypes";

export const DEFAULT_PAGE_LIMIT = 20;

const DEFAULT_QUERY: ListQuery = { page: 1, limit: DEFAULT_PAGE_LIMIT, order: "desc" };

export type RecordCollection<TItem> = {
  items: TItem[];
  meta: ListMeta | null;
  isLoading: boolean;
  error: string | null;
  query: ListQuery;
  /** Any filter change returns to page one; only `setPage` keeps the page. */
  updateQuery: (updater: (current: ListQuery) => ListQuery) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;
  refetch: () => void;
  remove: (id: string) => Promise<void>;
  isMutating: boolean;
  /**
   * Bumped on every refetch. A summary shares it so the totals and the rows they
   * describe always come from the same read.
   */
  reloadToken: number;
};

/**
 * One list state machine for all four resources.
 *
 * The list and delete functions are injected, which keeps this hook free of any
 * knowledge about loans versus expenses. Both must be module-level references
 * so the effect below does not re-run on every render.
 */
export const useRecordCollection = <TItem,>(config: {
  list: (request: AuthedRequest, query: ListQuery) => Promise<ListResponse<TItem>>;
  remove: (request: AuthedRequest, id: string) => Promise<void>;
  /**
   * A filter the screen owns, applied on top of the user's own.
   *
   * For narrowing the list from outside the toolbar — `/investments` showing one kind of
   * holding at a time, driven by its tabs. It goes into the *query* rather than filtering rows
   * in the browser, because the server has to do the narrowing: paging through everything and
   * then discarding most of it makes page two of a single-type table empty while page one is
   * not, and silently caps the count at whatever the page held.
   *
   * The user's filters are layered over this rather than replacing it, so choosing one on the
   * toolbar narrows within the tab instead of escaping it.
   */
  baseQuery?: ListQuery;
}) => {
  const { authorisedRequest } = useAuth();
  const { list, remove: removeRecord, baseQuery } = config;

  /*
   * Seeded once. Re-seeding on every `baseQuery` change would throw away the user's page,
   * sort and filters each time they switch tabs, which reads as the screen having forgotten
   * what they asked for — so switching a tab re-reads the same query under the new filter.
   */
  const [query, setQuery] = useState<ListQuery>({
    ...DEFAULT_QUERY,
    ...baseQuery,
  });
  const [items, setItems] = useState<TItem[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await list(authorisedRequest, query);
        if (cancelled) {
          return;
        }

        setItems(result.items);
        setMeta(result.meta);
      } catch (thrown) {
        if (cancelled) {
          return;
        }

        setItems([]);
        setMeta(null);
        setError(getAuthErrorCopy(thrown).banner);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authorisedRequest, list, query, reloadToken]);

  const updateQuery = useCallback((updater: (current: ListQuery) => ListQuery) => {
    setQuery((current) => ({ ...updater(current), page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setQuery((current) => ({ ...current, page }));
  }, []);

  /*
   * The screen's own filter takes effect when it changes, layered *over* whatever the user
   * has chosen rather than replacing it. Switching tabs re-points the list at a different set
   * of holdings — it is not a reason to forget their sort order or throw away a filter they
   * set — and page one because page four of the previous subject means nothing here.
   *
   * Keyed on the serialised filter so an object literal rebuilt on every render does not count
   * as a change and bounce the list back to page one continuously.
   */
  const baseKey = JSON.stringify(baseQuery ?? {});
  const previousBaseQuery = useRef<ListQuery | undefined>(baseQuery);

  useEffect(() => {
    if (JSON.stringify(previousBaseQuery.current ?? {}) === baseKey) {
      return;
    }

    const stale: ListQuery = previousBaseQuery.current ?? {};
    previousBaseQuery.current = baseQuery;

    setQuery((current) => {
      const next = { ...current };

      /*
       * Drop the keys this filter used to set and no longer sets, before layering the new one
       * over the top.
       *
       * Layering alone cannot do this. Merging `{...current, ...baseQuery}` adds the new filter
       * but never *removes* one, and spreading `undefined` adds nothing at all — so dropping back
       * to no filter (the "Everything" tab) left the previous kind's `type` sitting in the query,
       * and the list went on showing that kind's rows while claiming to show everything.
       */
      for (const key of Object.keys(stale) as (keyof ListQuery)[]) {
        if (!(key in (baseQuery ?? {}))) {
          delete next[key];
        }
      }

      return { ...next, ...baseQuery, page: 1 };
    });
  }, [baseKey, baseQuery]);

  const resetFilters = useCallback(() => {
    // Keeps the screen's own filter: clearing a category filter should not also escape the tab
    // the user is on.
    setQuery({ ...DEFAULT_QUERY, ...baseQuery });
  }, []);

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const remove = useCallback(
    async (id: string) => {
      setIsMutating(true);
      try {
        await removeRecord(authorisedRequest, id);
        // The server owns the totals, so the list is re-read rather than patched
        // locally. `meta.total` would otherwise drift from the table.
        refetch();
      } finally {
        setIsMutating(false);
      }
    },
    [authorisedRequest, refetch, removeRecord]
  );

  return {
    items,
    meta,
    isLoading,
    isMutating,
    error,
    query,
    updateQuery,
    setPage,
    resetFilters,
    refetch,
    remove,
    reloadToken,
  };
};