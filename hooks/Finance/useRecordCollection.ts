"use client";

import { useCallback, useEffect, useState } from "react";
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
}) => {
  const { authorisedRequest } = useAuth();
  const { list, remove: removeRecord } = config;

  const [query, setQuery] = useState<ListQuery>(DEFAULT_QUERY);
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

  const resetFilters = useCallback(() => {
    setQuery(DEFAULT_QUERY);
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