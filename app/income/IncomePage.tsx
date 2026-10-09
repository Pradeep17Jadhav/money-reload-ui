"use client";

import { useCallback, useMemo, useState } from "react";
import { todayAsDateOnly } from "@/helpers/dates";
import type { Config } from "@/types/ConfigTypes";
import RecordsPage from "@/components/Records/RecordsPage/RecordsPage";
import ImportIncomeTaxDialog from "@/components/Income/ImportIncomeTaxDialog/ImportIncomeTaxDialog";
import {
  isImportedIncome,
  useImportedIncomeFigures,
} from "@/hooks/Income/useImportedIncomeFigures";
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
  INCOME_FIELDS,
  INCOME_FILTERS,
  INCOME_SORT_OPTIONS,
  incomeColumns,
  incomeSummaryTiles,
} from "@/components/Income/IncomeConfig";

/** New entries default to today, which is what a user almost always means. */
const IncomePage = ({ incomeTaxConfig }: { incomeTaxConfig: Config["incomeTax"] }) => {
  const budgets = useMemo(() => incomeTaxConfig.budgets ?? [], [incomeTaxConfig]);

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

  const { summary, isLoading, error } = useRecordSummary(
    getIncomesSummary,
    collection.query,
    collection.reloadToken
  );

  /*
   * Imported incomes carry no amount and no tax of their own, so every one of them has to be
   * resolved against its scenario before the table can be drawn — all of them at once, in one
   * request, because resolving them per row would put a round trip between the user and the
   * figures they came to read.
   */
  const { figuresFor } = useImportedIncomeFigures(
    collection.items,
    budgets,
    collection.reloadToken
  );

  /*
   * The import dialog, used for both creating one and editing an existing imported income. A
   * generic "edit income" would offer amount and tax on a record that owns neither, and either
   * fail or drop them silently — so an imported income opens this instead, and shows the
   * scenario's figures rather than letting them be overridden.
   */
  const [incomeTaxDialog, setIncomeTaxDialog] = useState<{
    isOpen: boolean;
    income: Income | null;
  }>({ isOpen: false, income: null });

  const openImport = useCallback(
    () => setIncomeTaxDialog({ isOpen: true, income: null }),
    []
  );

  const closeImport = useCallback(
    () => setIncomeTaxDialog({ isOpen: false, income: null }),
    []
  );

  const onRowEdit = useCallback((income: Income) => {
    if (!isImportedIncome(income)) {
      // Not imported: the generic form is right for it, since every field is its own.
      return false;
    }

    setIncomeTaxDialog({ isOpen: true, income });

    return true;
  }, []);

  const columns = useMemo(() => incomeColumns(figuresFor), [figuresFor]);

  return (
    <>
      <RecordsPage
        title="Income"
        subtitle="Everything coming in, and where it came from."
        addLabel="Add income"
        secondaryAction={{ label: "Import income", onClick: openImport }}
        submitLabel="add income"
        editSubmitLabel="save changes"
        emptyMessage="No income recorded yet. Add your first entry to see what is coming in."
        caption="income entry"
        deleteMessage="This income entry will be removed from your records and from every total. It cannot be undone from here."
        columns={columns}
        sortOptions={INCOME_SORT_OPTIONS}
        filters={INCOME_FILTERS}
        summaryTiles={incomeSummaryTiles(summary)}
        summaryError={error}
        isSummaryLoading={isLoading}
        collection={collection}
        screen={screen}
        onRowEdit={onRowEdit}
      />

      <ImportIncomeTaxDialog
        open={incomeTaxDialog.isOpen}
        income={incomeTaxDialog.income}
        budgets={budgets}
        onClose={closeImport}
        onSaved={collection.refetch}
      />
    </>
  );
};

export default IncomePage;