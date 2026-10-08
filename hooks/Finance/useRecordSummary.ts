"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { getAuthErrorCopy } from "@/helpers/apiErrors";
import type { AuthedRequest } from "@/services/finance/records";
import type { ListQuery } from "@/types/FinanceTypes";

export type RecordSummary<TSummary> = {
  summary: TSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

/** A stable reference for callers that want unfiltered totals. */
export const NO_FILTERS: ListQuery = {};

/**
 * One summary state machine. The four `/summary` endpoints share the same
 * envelope and accept the same range and filters as their list, so a page's
 * totals always describe exactly the rows its table is showing.
 *
 * `query` must be a stable reference. An object literal created inline during
 * render would change identity on every pass and re-trigger the effect.
 */
export const useRecordSummary = <TSummary,>(
  fetcher: (request: AuthedRequest, query: ListQuery) => Promise<TSummary>,
  query: ListQuery = {},
  /**
   * Shared with the collection so a create, edit or delete refreshes the rows
   * and their totals together. Without this the tiles would keep showing the
   * totals from before the change.
   */
  reloadToken: number = 0
) => {
  const { authorisedRequest } = useAuth();
  const [summary, setSummary] = useState<TSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localReloadToken, setLocalReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetcher(authorisedRequest, query);
        if (!cancelled) {
          setSummary(result);
        }
      } catch (thrown) {
        if (!cancelled) {
          setSummary(null);
          setError(getAuthErrorCopy(thrown).banner);
        }
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
  }, [authorisedRequest, fetcher, query, reloadToken, localReloadToken]);

  const refetch = useCallback(() => {
    setLocalReloadToken((token) => token + 1);
  }, []);

  return { summary, isLoading, error, refetch };
};