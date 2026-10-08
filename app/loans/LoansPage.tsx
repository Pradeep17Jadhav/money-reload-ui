"use client";

import { useCallback, useState } from "react";
import RecordsPage from "@/components/Records/RecordsPage/RecordsPage";
import ImportLoanDialog from "@/components/Loans/ImportLoanDialog/ImportLoanDialog";
import { useRecordCollection } from "@/hooks/Finance/useRecordCollection";
import { useRecordsScreen } from "@/hooks/Finance/useRecordsScreen";
import { createLoan, deleteLoan, listLoans, updateLoan } from "@/services/finance/records";
import type { Loan } from "@/types/FinanceTypes";
import type { CrossFieldRule } from "@/types/RecordFormTypes";
import {
  LOAN_FIELDS,
  LOAN_FILTERS,
  LOAN_SORT_OPTIONS,
  loanColumns,
  loanSummaryTiles,
} from "@/components/Loans/LoansConfig";
import { useImportedLoanFigures } from "@/components/Loans/useImportedLoanFigures";
import { useLoanTotals } from "@/components/Loans/useLoanTotals";

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

  /*
   * Imported loans carry no figures of their own, so every one of them has to be resolved
   * against its calculation before the table can be drawn. All of them at once, in one
   * request — resolving them per row would put a round trip between the user and the
   * figures they came to read.
   */
  const { figuresFor, isResolving } = useImportedLoanFigures(
    collection.items,
    collection.reloadToken
  );

  // A second, unfiltered read: the tiles total every loan, not just the page on screen, and
  // a total over one page of twenty would read as the whole picture.
  const totals = useLoanTotals(collection.reloadToken);

  const [loanDialog, setLoanDialog] = useState<{
    isOpen: boolean;
    loan: Loan | null;
  }>({ isOpen: false, loan: null });

  const openImport = useCallback(() => setLoanDialog({ isOpen: true, loan: null }), []);
  const closeImport = useCallback(() => setLoanDialog({ isOpen: false, loan: null }), []);

  /*
   * An imported loan opens the import dialog rather than the generic edit form, because it
   * stores no principal, rate, end date or EMI — the generic form would show a row of empty
   * boxes for the fields that matter and offer to set the ones the API refuses on a linked
   * loan. A recorded loan owns every one of its fields, so it keeps the generic form.
   */
  const onRowEdit = useCallback((loan: Loan) => {
    if (typeof loan.loanCalculationId !== "string" || loan.loanCalculationId.length === 0) {
      return false;
    }

    setLoanDialog({ isOpen: true, loan });

    return true;
  }, []);

  return (
    <>
      <RecordsPage
        title="Loans"
        subtitle="Every loan you hold, with what you pay each month."
        addLabel="Add loan"
        secondaryAction={{ label: "Import loan", onClick: openImport }}
        submitLabel="add loan"
        editSubmitLabel="save changes"
        emptyMessage="No loans yet. Add your first one to start tracking what you owe."
        caption="loan"
        deleteMessage="This loan will be removed from your records and from every total. It cannot be undone from here."
        columns={loanColumns(figuresFor)}
        sortOptions={LOAN_SORT_OPTIONS}
        filters={LOAN_FILTERS}
        summaryTiles={loanSummaryTiles(totals, isResolving)}
        summaryError={totals.error}
        isSummaryLoading={totals.isLoading}
        collection={collection}
        screen={screen}
        onRowEdit={onRowEdit}
      />

      <ImportLoanDialog
        open={loanDialog.isOpen}
        loan={loanDialog.loan}
        onClose={closeImport}
        onSaved={collection.refetch}
      />
    </>
  );
};

export default LoansPage;
