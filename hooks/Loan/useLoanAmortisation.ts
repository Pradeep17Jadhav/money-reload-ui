import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dayjs } from "dayjs";
import { sanitizeROI } from "@/helpers/numbers";
import { AmortisationTableFrequency } from "@/types/Loan/LoanTypes";
import type {
  AmortisationOverrides,
  LoanData,
  MonthOverride,
} from "@/types/Loan/LoanTypes";
import { buildAmortisation } from "@/components/Common/LoanCalculator/helpers/amortisation";
import { generatePDF } from "@/components/Common/LoanCalculator/helpers/pdfGenerator";
import { Tenure } from "@/types/ConfigTypes";
import { PrepaymentsByMonth } from "./usePrepayments";
import { useCurrency } from "@/contexts/currency";
import { AnalyticsEventType, trackEvent } from "@/helpers/analytics";

export const useLoanAmortisation = (
  loanAmount: number,
  roi: string,
  tenure: Tenure,
  prepaymentsByMonth: PrepaymentsByMonth,
  hasPrepayments: boolean,
  startMonth: Dayjs
) => {
  const { formatAmount } = useCurrency();
  const tenureMonths = tenure.years * 12 + tenure.months;

  /**
   * Manual changes, keyed by month index. Deliberately separate from the schedule
   * so an edit is an instruction rather than a rewrite of the numbers, and so
   * every later month can be re-derived from it.
   */
  const [overrides, setOverrides] = useState<AmortisationOverrides>({});

  const sanitizedROI = sanitizeROI(roi);
  const isIncompleteROT = sanitizedROI[sanitizedROI.length - 1] === ".";
  const rateOfInterest = isIncompleteROT
    ? parseFloat(sanitizedROI.split(".")[0])
    : parseFloat(sanitizedROI);

  /**
   * The first month of the schedule, from the start month the user chose.
   *
   * Memoised because a fresh Dayjs object on every render would change the
   * memo's dependencies each time and rebuild the whole schedule for nothing.
   */
  const baseDate = useMemo(() => startMonth.startOf("month"), [startMonth]);

  const schedule = useMemo(
    () =>
      buildAmortisation({
        loanAmount,
        rateOfInterest,
        tenureMonths,
        baseDate,
        prepaymentsByMonth,
        overrides,
      }),
    [baseDate, loanAmount, overrides, prepaymentsByMonth, rateOfInterest, tenureMonths]
  );

  const hasManualChanges = Object.keys(overrides).length > 0;

  /**
   * Records a change against one month. The EMI and the rate carry forward to
   * every later month; a prepayment stays on the month it was entered against.
   * Later changes stack, so editing month 30 after month 12 keeps both.
   */
  const applyMonthChange = useCallback(
    (monthIndex: number, change: MonthOverride) => {
      setOverrides((current) => {
        const next = { ...current };

        for (const key of Object.keys(change) as (keyof MonthOverride)[]) {
          if (change[key] === undefined) {
            delete next[monthIndex]?.[key];
            continue;
          }

          next[monthIndex] = { ...next[monthIndex], [key]: change[key] };
        }

        // A month left with nothing is not a change.
        if (next[monthIndex] && Object.keys(next[monthIndex]).length === 0) {
          delete next[monthIndex];
        }

        return next;
      });
    },
    []
  );

  const clearMonthChange = useCallback((monthIndex: number) => {
    setOverrides((current) => {
      const next = { ...current };
      delete next[monthIndex];
      return next;
    });
  }, []);

  const clearManualChanges = useCallback(() => {
    setOverrides({});
  }, []);

  const getMonthChange = useCallback(
    (monthIndex: number): MonthOverride => overrides[monthIndex] ?? {},
    [overrides]
  );

  const downloadAmortisation = useCallback(
    (tableFrequency: AmortisationTableFrequency = AmortisationTableFrequency.Monthly) => {
      const isYearly = tableFrequency === AmortisationTableFrequency.Yearly;
      const tableData = isYearly ? schedule.yearlyRows : schedule.monthlyRows;
      const monthYear = Number(baseDate.format("YYYYMM"));
      const loanData: LoanData = {
        loanAmount,
        rateOfInterest,
        tenureMonths,
        tenureWithPrepaymentMonths: schedule.monthlyRows.length,
        emi: schedule.baseEmi,
        monthYear,
        hasPrepayments: hasPrepayments || hasManualChanges,
        totalPrepayments: schedule.totals.totalPrepayments,
        totalPrincipalPaid: schedule.totals.principalPaid,
        totalInterestPaid: schedule.totals.interestPaid,
      };
      generatePDF(tableData, loanData, tableFrequency, formatAmount);
      trackEvent(
        isYearly
          ? AnalyticsEventType.AMORTISATION_YEARLY_PDF
          : AnalyticsEventType.AMORTISATION_MONTHLY_PDF
      );
    },
    [
      schedule,
      baseDate,
      loanAmount,
      rateOfInterest,
      tenureMonths,
      hasPrepayments,
      hasManualChanges,
      formatAmount,
    ]
  );

  // A different loan is a different schedule, so the changes attached to the old
  // one no longer mean anything.
  useEffect(() => {
    setOverrides({});
  }, [loanAmount, roi, tenureMonths, prepaymentsByMonth]);

  return {
    yearlyRowData: schedule.yearlyRows,
    monthlyRowData: schedule.monthlyRows,
    downloadAmortisation,
    interestPaidActual: schedule.totals.interestPaid,
    principalPaidActual: schedule.totals.principalPaid,
    totalPrepayments: schedule.totals.totalPrepayments,
    timesPaidActual: schedule.totals.timesPaid,
    totalPaidActual: schedule.totals.totalPayment,
    baseEmi: schedule.baseEmi,
    overrides,
    hasManualChanges,
    applyMonthChange,
    clearMonthChange,
    clearManualChanges,
    getMonthChange,
  };
};