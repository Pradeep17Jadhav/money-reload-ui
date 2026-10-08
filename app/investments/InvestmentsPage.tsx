"use client";

import { useCallback, useMemo, useState } from "react";
import { todayAsDateOnly } from "@/helpers/dates";
import RecordsPage from "@/components/Records/RecordsPage/RecordsPage";
import InvestmentTypeTabs from "@/components/Investments/InvestmentTypeTabs/InvestmentTypeTabs";
import { useRecordCollection } from "@/hooks/Finance/useRecordCollection";
import { useRecordsScreen } from "@/hooks/Finance/useRecordsScreen";
import {
  createInvestment,
  deleteInvestment,
  listInvestments,
  updateInvestment,
} from "@/services/finance/records";
import type { Investment, InvestmentType } from "@/types/FinanceTypes";
import {
  CompoundingFrequency,
  InvestmentStatus,
  InvestmentType as InvestmentTypes,
} from "@/types/FinanceTypes";
import type { CrossFieldRule, FormValues } from "@/types/RecordFormTypes";
import {
  INVESTMENT_FIELDS,
  INVESTMENT_FILTERS,
  INVESTMENT_SORT_OPTIONS,
  investmentColumns,
  investmentSummaryTiles,
} from "@/components/Investments/InvestmentsConfig";
import { useInvestmentOverview } from "@/components/Investments/useInvestmentOverview";
import { projectInvestment } from "@/components/Investments/helpers/investmentProjection";
import {
  deriveInvestmentEditValues,
  syncTerminateOnChange,
} from "@/components/Investments/helpers/tenureSync";

/**
 * An end date has to be after the start date.
 *
 * Checked here rather than left to the API because the API never sees an end date — it is
 * worked out from the term, and a term runs forwards. A backwards one would put the maturity
 * before the deposit, which no later check could catch because by then the dropdowns have
 * already been rewritten to agree with it.
 */
const INVESTMENT_RULES: CrossFieldRule[] = [
  {
    fields: ["startDate", "endDate"],
    isValid: (values: FormValues) => {
      const start = String(values.startDate ?? "");
      const end = String(values.endDate ?? "");

      // No end date means no term yet, which is not an error — only a backwards one is.
      if (!start || !end) {
        return true;
      }

      return end > start;
    },
    message: "End date must be after the start date.",
    attachTo: "endDate",
  },
];

const InvestmentsPage = () => {
  /**
   * Which kind of holding is on screen.
   *
   * `null` means every kind together — and that is **not the landing state**. A user arriving
   * here wants their FDs on their deposits' table, not one table with a "Type" column and a row
   * of dashes where a shareholding has no rate. So the first kind they actually hold is what
   * they see, and mixing is something they choose.
   *
   * Kept as two pieces rather than one nullable selection so that "nothing chosen yet" is not
   * confused with "show me everything" — the first is the default, the second is not.
   */
  const [chosenType, setChosenType] = useState<InvestmentType | null>(null);
  const [showEveryType, setShowEveryType] = useState(false);

  /*
   * Owned here rather than taken from the collection's reload token, because the tab bar and
   * the tiles are totalled from a read of their own — and that read is what decides which
   * table is shown, so it cannot in turn depend on the table.
   */
  const [dataToken, setDataToken] = useState(0);

  const overview = useInvestmentOverview(dataToken);

  const selectedType = useMemo<InvestmentType | null>(() => {
    if (showEveryType) {
      return null;
    }

    // A kind they have since closed out drops off the list, so a selection that no longer
    // exists falls back rather than leaving a table with nothing on it.
    return chosenType !== null && overview.typesPresent.includes(chosenType)
      ? chosenType
      : overview.typesPresent[0] ?? null;
  }, [chosenType, overview.typesPresent, showEveryType]);

  const handleSelect = useCallback((type: InvestmentType | null) => {
    setChosenType(type);
    setShowEveryType(type === null);
  }, []);

  const collection = useRecordCollection<Investment>({
    list: listInvestments,
    remove: deleteInvestment,
    /**
     * Narrowing goes into the query rather than filtering rows in the browser, so the server
     * does the work and **pagination stays correct**. Filtering client-side would page through
     * every holding and then throw most away, making page two of a single-type table empty
     * while page one is not.
     */
    baseQuery: useMemo(
      () => (selectedType === null ? undefined : { type: [selectedType] }),
      [selectedType]
    ),
  });

  const onMutated = useCallback(() => {
    // Both reads, not just the table: adding a holding changes which kinds the tab bar offers,
    // and the tiles are totalled from that other read.
    collection.refetch();
    setDataToken((token) => token + 1);
  }, [collection]);

  const screen = useRecordsScreen<Investment>({
    /*
     * One field list, and which fields are shown follows the chosen type — a fixed deposit
     * asks for a rate and a term, a shareholding asks what it is worth now. Nothing here is a
     * derived *figure* — no maturity value, no profit — because each is arithmetic worked out on
     * every read.
     *
     * The end date is the one derived field that is asked for, and it is asked for as a date
     * because a term of "5 years, 0 months, 0 days" is harder to picture than a date you can
     * read back. It is never sent: the API holds the term and works the date out itself.
     */
    fields: INVESTMENT_FIELDS,
    crossFieldRules: INVESTMENT_RULES,
    // Local calendar date, not `toISOString`, which shifts the day west of UTC.
    createDefaults: {
      startDate: todayAsDateOnly(),
      type: InvestmentTypes.FD,
      // Quarterly is what an FD almost always is, and what the FD calculator quotes, so a
      // holding made here and the same figures entered there give the same number. Said on the
      // control rather than left to the projection's fallback, because a picker showing a blank
      // is not the same as one showing the answer it is going to use.
      compoundingsPerYear: String(CompoundingFrequency.QUARTERLY),
      // A holding is assumed live until the user says otherwise; the alternative is a new form
      // opening on "Closed", which is a claim about the past the user has not made.
      status: InvestmentStatus.ACTIVE,
    },
    recordToValues: (investment) => investment as unknown as Record<string, unknown>,
    deriveEditValues: deriveInvestmentEditValues,
    applyChange: syncTerminateOnChange,
    getId: (investment) => investment.id,
    create: createInvestment,
    update: updateInvestment,
    remove: deleteInvestment,
    onMutated,
  });

  /**
   * Every figure in this screen is worked out from the record, on every render. The memo is
   * what stops a page of forty holdings from re-running the arithmetic forty times per paint.
   */
  const projectionFor = useCallback(
    (investment: Investment) => projectInvestment(investment),
    []
  );

  const columns = useMemo(
    () => investmentColumns(projectionFor, selectedType),
    [projectionFor, selectedType]
  );

  // The tiles describe the table on screen, not the whole portfolio — the two are one click
  // apart, and a total that quietly changed meaning with a tab would be the same trap as a
  // total that quietly excluded something.
  const totals =
    selectedType === null
      ? overview.totals
      : overview.byType.get(selectedType) ?? overview.totals;

  return (
    <RecordsPage
      title="Investments"
      subtitle="Everything you have put away, and what it is worth."
      addLabel="Add investment"
      submitLabel="add investment"
      editSubmitLabel="save changes"
      emptyMessage="Nothing recorded yet. Add an FD, a SIP or a holding to see what you have put away."
      caption="investment"
      deleteMessage="This investment will be removed from your records and from every total. It cannot be undone from here."
      columns={columns}
      sortOptions={INVESTMENT_SORT_OPTIONS}
      filters={INVESTMENT_FILTERS}
      summaryTiles={investmentSummaryTiles(totals)}
      summaryError={null}
      isSummaryLoading={false}
      collection={collection}
      screen={screen}
      // With the toolbar above it, so the tabs read as a second row of the same controls
      // rather than as part of the page's heading.
      tableHeader={
        <InvestmentTypeTabs
          typesPresent={overview.typesPresent}
          selected={selectedType}
          onSelect={handleSelect}
        />
      }
    />
  );
};

export default InvestmentsPage;