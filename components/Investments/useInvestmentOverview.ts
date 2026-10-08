"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { listInvestments } from "@/services/finance/records";
import { MAX_PAGE_LIMIT } from "@/constants/records";
import { projectInvestment } from "@/components/Investments/helpers/investmentProjection";
import type { InvestmentTotals } from "@/components/Investments/InvestmentsConfig";
import type { Investment, InvestmentType } from "@/types/FinanceTypes";

/** One kind's totals, and the same totals across every kind. */
export type InvestmentOverview = {
  totals: InvestmentTotals;
  /** A total per kind, so choosing a tab costs nothing extra to switch to. */
  byType: Map<InvestmentType, InvestmentTotals>;
  typesPresent: InvestmentType[];
};

const EMPTY_TOTALS: InvestmentTotals = {
  totalInvested: 0,
  totalCurrentValue: 0,
  totalProfit: 0,
  unresolved: 0,
  recordCount: 0,
  typesPresent: [],
  isLoading: false,
};

/**
 * Every holding, totalled once.
 *
 * **There is no server total for this route, and that is deliberate rather than a gap.** Each
 * figure — a deposit's value, a SIP's, a holding's profit — is arithmetic over the stored
 * inputs, so an aggregate on the server could only have summed the amounts and missed the
 * returns entirely.
 *
 * Read once, unfiltered, and totalled **per kind as well as overall**. Splitting by kind here
 * rather than re-reading on every tab is what keeps the tab bar from needing a request of its
 * own, and — more importantly — what breaks what would otherwise be a cycle: the tab list is
 * built from what the user holds, and the table is narrowed to whichever kind is on screen, so
 * each would otherwise have to wait on the other.
 *
 * Capped at {@link MAX_PAGE_LIMIT} holdings, the same ceiling the API enforces. The count sits
 * beside the total, so a shortfall is visible rather than inferred.
 */
export const useInvestmentOverview = (
  reloadToken = 0
): InvestmentOverview => {
  const { authorisedRequest } = useAuth();
  const [holdings, setHoldings] = useState<Investment[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { items } = await listInvestments(authorisedRequest, {
          limit: MAX_PAGE_LIMIT,
        });

        if (!cancelled) {
          setHoldings(items);
        }
      } catch {
        if (!cancelled) {
          setHoldings([]);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authorisedRequest, reloadToken]);

  return useMemo(() => {
    const typesPresent: InvestmentType[] = [];
    const byType = new Map<InvestmentType, InvestmentTotals>();
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let unresolved = 0;

    for (const investment of holdings) {
      const projection = projectInvestment(investment);

      if (!byType.has(investment.type)) {
        byType.set(investment.type, { ...EMPTY_TOTALS, typesPresent: [] });
        typesPresent.push(investment.type);
      }

      const bucket = byType.get(investment.type) as InvestmentTotals;

      if (!projection) {
        /*
         * Counted rather than skipped silently. A holding with no amount is not worth
         * nothing, so adding zero would report a total that is short without saying why.
         */
        unresolved += 1;
        bucket.unresolved += 1;

        continue;
      }

      totalInvested += projection.invested;
      totalCurrentValue += projection.currentValue;

      bucket.totalInvested += projection.invested;
      bucket.totalCurrentValue += projection.currentValue;
      bucket.recordCount += 1;
    }

    for (const bucket of byType.values()) {
      bucket.totalProfit = bucket.totalCurrentValue - bucket.totalInvested;
    }

    return {
      byType,
      typesPresent: [...typesPresent].sort(),
      totals: {
        totalInvested,
        totalCurrentValue,
        totalProfit: totalCurrentValue - totalInvested,
        unresolved,
        recordCount: holdings.length,
        typesPresent: [...typesPresent].sort(),
        isLoading: false,
      },
    };
  }, [holdings]);
};