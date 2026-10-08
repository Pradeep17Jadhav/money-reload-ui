"use client";

import { todayAsDateOnly } from "@/helpers/dates";
import RecordsPage from "@/components/Records/RecordsPage/RecordsPage";
import { useRecordCollection } from "@/hooks/Finance/useRecordCollection";
import { useRecordSummary } from "@/hooks/Finance/useRecordSummary";
import { useRecordsScreen } from "@/hooks/Finance/useRecordsScreen";
import {
  createIncome,
  deleteIncome,
  getIncomesSummary,
  listIncomes,
  updateIncome,
} from "@/services/finance/records";
import type { Income } from "@/types/FinanceTypes";
import {
  INCOME_COLUMNS,
  INCOME_FIELDS,
  INCOME_FILTERS,
  INCOME_SORT_OPTIONS,
  incomeSummaryTiles,
} from "@/components/Income/IncomeConfig";

/** New entries default to today, which is what a user almost always means. */
const IncomePage = () => {
  const collection = useRecordCollection<Income>({
    list: listIncomes,
    remove: deleteIncome,
  });

  const screen = useRecordsScreen<Income>({
    fields: INCOME_FIELDS,
    // Local calendar date, not `toISOString`, which shifts the day west of UTC.
    createDefaults: { date: todayAsDateOnly() },
    recordToValues: (income) => income as unknown as Record<string, unknown>,
    getId: (income) => income.id,
    create: createIncome,
    update: updateIncome,
    remove: deleteIncome,
    onMutated: collection.refetch,
  });

  const { summary, isLoading, error } = useRecordSummary(getIncomesSummary, collection.query, collection.reloadToken);

  return (
    <RecordsPage
      title="Income"
      subtitle="Everything coming in, and where it came from."
      addLabel="Add income"
      submitLabel="add income"
      editSubmitLabel="save changes"
      emptyMessage="No income recorded yet. Add your first entry to see what is coming in."
      caption="income entry"
      deleteMessage="This income entry will be removed from your records and from every total. It cannot be undone from here."
      columns={INCOME_COLUMNS}
      sortOptions={INCOME_SORT_OPTIONS}
      filters={INCOME_FILTERS}
      summaryTiles={incomeSummaryTiles(summary)}
      summaryError={error}
      isSummaryLoading={isLoading}
      collection={collection}
      screen={screen}
    />
  );
};

export default IncomePage;