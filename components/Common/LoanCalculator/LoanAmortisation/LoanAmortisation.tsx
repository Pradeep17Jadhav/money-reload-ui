import { useCallback, useEffect, useMemo, useState } from "react";
import { TableContainer, useMediaQuery, useTheme } from "@mui/material";
import Section from "@/components/Section/Section";
import {
  AmortisationTableFrequency,
  AmortisationRow,
  MonthOverride,
} from "@/types/Loan/LoanTypes";
import { getDesktopColumns, getTabletColumns } from "../constants";
import SmallButton from "@/components/Buttons/SmallButton/SmallButton";
import AmortisationMonthDialog from "@/components/Loan/AmortisationMonthDialog/AmortisationMonthDialog";
import YearlyTable from "./components/YearlyTable/YearlyTable";

import styles from "./LoanAmortisation.module.css";

type Props = {
  hasPrepayments: boolean;
  /** True once the user has changed a month, which adds the ROI and prepayment columns. */
  hasManualChanges: boolean;
  amortisationDataYearly: AmortisationRow[];
  amortisationDataMonthly: AmortisationRow[];
  downloadAmortisation: (tableFrequency?: AmortisationTableFrequency) => void;
  overrides: Record<number, MonthOverride>;
  onApplyMonthChange: (monthIndex: number, change: MonthOverride) => void;
  onResetMonthChange: (monthIndex: number) => void;
};

const LoanAmortisation = ({
  hasPrepayments,
  hasManualChanges,
  amortisationDataYearly,
  amortisationDataMonthly,
  downloadAmortisation,
  overrides,
  onApplyMonthChange,
  onResetMonthChange,
}: Props) => {
  const theme = useTheme();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(
    null
  );
  const isDesktop = useMediaQuery(theme.breakpoints.up("md")); // >900px

  const columns = isDesktop
    ? getDesktopColumns(hasPrepayments, hasManualChanges)
    : getTabletColumns(hasPrepayments, hasManualChanges);

  const toggleRow = (year: number) => {
    setExpandedRows((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(year)) {
        newExpanded.delete(year);
      } else {
        newExpanded.add(year);
      }
      return newExpanded;
    });
  };

  const handleAmortisationDownload = useCallback(
    (frequency: AmortisationTableFrequency) => () =>
      downloadAmortisation(frequency),
    [downloadAmortisation]
  );

  const selectedMonth = useMemo(
    () =>
      selectedMonthIndex === null
        ? null
        : amortisationDataMonthly.find(
            (row) => row.monthIndex === selectedMonthIndex
          ) ?? null,
    [amortisationDataMonthly, selectedMonthIndex]
  );

  /**
   * What was still owed before this month's instalment. The balance on the row is
   * the closing figure, so this is the previous month's closing balance.
   *
   * The first month has no previous row, so it is worked backwards off its own
   * figures — which means the disbursement has to be added back, since it was
   * advanced at the top of the month rather than repaid out of it.
   */
  const openingBalance = useMemo(() => {
    if (selectedMonthIndex === null) {
      return 0;
    }

    if (selectedMonthIndex === 0) {
      const first = amortisationDataMonthly[0];

      return first
        ? first.balance +
            first.principalPaid +
            first.prepayments +
            first.disbursements
        : 0;
    }

    return (
      amortisationDataMonthly.find(
        (row) => row.monthIndex === selectedMonthIndex - 1
      )?.balance ?? 0
    );
  }, [amortisationDataMonthly, selectedMonthIndex]);

  const handleApply = useCallback(
    (change: MonthOverride) => {
      if (selectedMonthIndex !== null) {
        onApplyMonthChange(selectedMonthIndex, change);
      }
      setSelectedMonthIndex(null);
    },
    [onApplyMonthChange, selectedMonthIndex]
  );

  /** Drops this month's stored change. The dialog stays open and refills. */
  const handleResetMonth = useCallback(() => {
    if (selectedMonthIndex !== null) {
      onResetMonthChange(selectedMonthIndex);
    }
  }, [onResetMonthChange, selectedMonthIndex]);

  /**
   * A one-year loan opens expanded because there is nothing to reveal.
   *
   * This used to reset the set on every recalculation, which meant saving a month
   * change collapsed whatever the user had opened. Now it only ever adds: years the
   * user has open stay open, and any that no longer exist in the data are dropped.
   */
  useEffect(() => {
    setExpandedRows((current) => {
      const years = new Set(amortisationDataYearly.map((row) => row.year));
      const stillOpen = new Set([...current].filter((year) => years.has(year)));

      if (amortisationDataYearly.length === 1) {
        stillOpen.add(amortisationDataYearly[0].year);
      }

      return stillOpen;
    });
  }, [amortisationDataYearly]);

  return (
    <Section title="Loan Amortisation Schedule">
      <p className={styles.hint}>
        Select any month to change its EMI, prepayment, additional disbursement or rate of
        interest. A change to the EMI or the rate applies from that month to the end of the
        tenure.
      </p>

      <TableContainer>
        <YearlyTable
          expandedRows={expandedRows}
          amortisationDataYearly={amortisationDataYearly}
          amortisationDataMonthly={amortisationDataMonthly}
          columns={columns}
          toggleRow={toggleRow}
          overrides={overrides}
          selectedMonthIndex={selectedMonthIndex}
          onSelectMonth={setSelectedMonthIndex}
        />
      </TableContainer>

      <SmallButton
        className={styles.downloadPdfBtn}
        onClick={handleAmortisationDownload(AmortisationTableFrequency.Yearly)}
        centered
      >
        Download Yearly Amortisation PDF
      </SmallButton>
      <SmallButton
        className={styles.downloadPdfBtn}
        onClick={handleAmortisationDownload(AmortisationTableFrequency.Monthly)}
        centered
      >
        Download Monthly Amortisation PDF
      </SmallButton>

      <AmortisationMonthDialog
        open={selectedMonth !== null}
        month={selectedMonth}
        change={
          selectedMonthIndex === null ? {} : overrides[selectedMonthIndex] ?? {}
        }
        openingBalance={openingBalance}
        onClose={() => setSelectedMonthIndex(null)}
        onApply={handleApply}
        onResetMonth={handleResetMonth}
      />
    </Section>
  );
};

export default LoanAmortisation;