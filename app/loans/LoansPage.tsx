"use client";

import RecordsPage from "@/components/Records/RecordsPage/RecordsPage";
import { useRecordCollection } from "@/hooks/Finance/useRecordCollection";
import { useRecordSummary } from "@/hooks/Finance/useRecordSummary";
import { useRecordsScreen } from "@/hooks/Finance/useRecordsScreen";
import { createLoan, deleteLoan, getLoansSummary, listLoans, updateLoan } from "@/services/finance/records";
import type { Loan } from "@/types/FinanceTypes";
import type { CrossFieldRule } from "@/types/RecordFormTypes";
import {
  LOAN_COLUMNS,
  LOAN_FIELDS,
  LOAN_FILTERS,
  LOAN_SORT_OPTIONS,
  loanSummaryTiles,
} from "@/components/Loans/LoansConfig";

/** `endDate` must be strictly after `startDate`. Checked before the request. */
const LOAN_RULES: CrossFieldRule[] = [
  {
    fields: ["startDate", "endDate"],
    isValid: (values) => {
      const start = String(values.startDate ?? "");
      const end = String(values.endDate ?? "");

      if (!start || !end) {
        return true;
      }

      return end > start;
    },
    message: "End date must be after the start date.",
    attachTo: "endDate",
  },
];

const LoansPage = () => {
  const collection = useRecordCollection<Loan>({
    list: listLoans,
    remove: deleteLoan,
  });

  const screen = useRecordsScreen<Loan>({
    fields: LOAN_FIELDS,
    crossFieldRules: LOAN_RULES,
    recordToValues: (loan) => loan as unknown as Record<string, unknown>,
    getId: (loan) => loan.id,
    create: createLoan,
    update: updateLoan,
    remove: deleteLoan,
    onMutated: collection.refetch,
  });

  const { summary, isLoading, error } = useRecordSummary(getLoansSummary, collection.query, collection.reloadToken);

  return (
    <RecordsPage
      title="Loans"
      subtitle="Every loan you hold, with what you pay each month."
      addLabel="Add loan"
      submitLabel="add loan"
      editSubmitLabel="save changes"
      emptyMessage="No loans yet. Add your first one to start tracking what you owe."
      caption="loan"
      deleteMessage="This loan will be removed from your records and from every total. It cannot be undone from here."
      columns={LOAN_COLUMNS}
      sortOptions={LOAN_SORT_OPTIONS}
      filters={LOAN_FILTERS}
      summaryTiles={loanSummaryTiles(summary)}
      summaryError={error}
      isSummaryLoading={isLoading}
      collection={collection}
      screen={screen}
    />
  );
};

export default LoansPage;