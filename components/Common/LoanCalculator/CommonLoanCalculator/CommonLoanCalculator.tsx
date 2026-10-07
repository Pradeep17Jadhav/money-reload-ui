"use client";

import { useCallback, useMemo, useRef } from "react";
import TwoColumnContainer from "@/components/Common/TwoColumnContainer/TwoColumnContainer";
import { useLoanCalculator } from "@/hooks/Loan/useLoanCalculator";
import { LoanCalculatorType } from "@/types/ConfigTypes";
import { LoanCalculatorProps } from "@/components/Loan/LoanCalculatorSummary";
import { useLoanAmortisation } from "@/hooks/Loan/useLoanAmortisation";
import LoanAmortisation from "../LoanAmortisation/LoanAmortisation";
import CommonLoanCalculatorInput from "../CommonLoanCalculatorInput/CommonLoanCalculatorInput";
import { usePrepayment } from "@/hooks/Loan/usePrepayments";
import { usePrepaymentsProvider } from "@/contexts/loan/prepaymentsContext";
import {
  MAX_ROI,
  MIN_LOAN_AMOUNT,
  MIN_ROI,
  ROI_STEP,
} from "@/constants/calculator";
import UnderCalculatorAd from "@/components/Ads/UnderCalculatorAd/UnderCalculatorAd";
import {
  getLoanAmountInverseScaleByCurrency,
  getLoanAmountScaleByCurrency,
  getLoanMaxByCurrency,
} from "./constants";

import styles from "./CommonLoanCalculator.module.css";
import { useCurrency } from "@/contexts/currency";

type Props = {
  loanCalculatorType: LoanCalculatorType;
  Summary: React.ComponentType<LoanCalculatorProps>;
};

const CommonLoanCalculator = ({ loanCalculatorType, Summary }: Props) => {
  const { currency } = useCurrency();
  const resultRef = useRef<HTMLDivElement>(null);
  const {
    resultsReady,
    isValidForm,
    loanAmount,
    totalPaid,
    roi,
    tenure,
    startMonth,
    handleStartMonthChange,
    interestPaid,
    timesPaid,
    emi,
    calculate,
    handleLoanAmountChange,
    handleROIChange,
    handleTenureYearsChange,
    handleTenureMonthsChange,
  } = useLoanCalculator({ loanCalculatorType });

  const { prepayments } = usePrepaymentsProvider();
  const { prepaymentsByMonth, hasPrepayments } = usePrepayment({
    prepayments,
    tenure,
    startMonth,
  });

  const {
    yearlyRowData: yearlyAmortisationData,
    monthlyRowData: monthlyAmortisationData,
    downloadAmortisation,
    interestPaidActual,
    principalPaidActual,
    totalPrepayments,
    totalPaidActual,
    timesPaidActual,
    hasManualChanges,
    overrides,
    applyMonthChange,
    clearMonthChange,
  } = useLoanAmortisation(
    loanAmount,
    roi,
    tenure,
    prepaymentsByMonth,
    hasPrepayments,
    startMonth
  );

  const handleCalculateBtnClick = useCallback(
    (valid?: boolean) => {
      calculate(valid);
      resultRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    },
    [calculate]
  );

  const input = useMemo(
    () => (
      <CommonLoanCalculatorInput
        loanCalculatorType={loanCalculatorType}
        loanAmount={loanAmount}
        roi={roi}
        tenure={tenure}
        startMonth={startMonth}
        isValidForm={isValidForm}
        minAmount={MIN_LOAN_AMOUNT}
        maxAmount={getLoanMaxByCurrency(currency)}
        minRoi={MIN_ROI}
        maxRoi={MAX_ROI}
        stepAmount={1}
        stepRoi={ROI_STEP}
        calculate={handleCalculateBtnClick}
        handleLoanAmountChange={handleLoanAmountChange}
        handleROIChange={handleROIChange}
        handleTenureYearsChange={handleTenureYearsChange}
        handleTenureMonthsChange={handleTenureMonthsChange}
        handleStartMonthChange={handleStartMonthChange}
        getLoanAmountScale={getLoanAmountScaleByCurrency(currency)}
        getLoanAmountInverseScale={getLoanAmountInverseScaleByCurrency(
          currency
        )}
      />
    ),
    [
      loanCalculatorType,
      loanAmount,
      roi,
      tenure,
      startMonth,
      isValidForm,
      handleCalculateBtnClick,
      handleLoanAmountChange,
      handleROIChange,
      handleTenureYearsChange,
      handleTenureMonthsChange,
      handleStartMonthChange,
      currency,
    ]
  );

  /**
   * The closed-form totals only describe the loan as originally set up. As soon
   * as a prepayment or a manual change alters the schedule, the summary has to be
   * read back off the schedule instead, or it would contradict the table.
   */
  const useScheduleTotals = hasPrepayments || hasManualChanges;

  const summaryLoanProps = {
    hasPrepayments,
    hasManualChanges,
    principalPaid: useScheduleTotals ? principalPaidActual : loanAmount,
    timesMultiplied: useScheduleTotals ? timesPaidActual : timesPaid,
    totalPaid: useScheduleTotals ? totalPaidActual : totalPaid,
    interestPaid: useScheduleTotals ? interestPaidActual : interestPaid,
    prepayments: useScheduleTotals ? totalPrepayments : 0,
    starts: monthlyAmortisationData[0]?.year,
    ends: monthlyAmortisationData[monthlyAmortisationData.length - 1]?.year,
    prepaymentSavings: totalPaid - totalPaidActual,
  };

  return (
    <div className={styles.container}>
      <TwoColumnContainer
        leftColumn={input}
        rightColumn={
          <Summary
            ref={resultRef}
            resultsReady={resultsReady}
            isValidForm={isValidForm}
            loanAmount={loanAmount}
            roi={roi}
            emi={emi}
            {...summaryLoanProps}
          />
        }
      />

      <UnderCalculatorAd />

      {isValidForm && resultsReady && (
        <LoanAmortisation
          hasPrepayments={hasPrepayments}
          hasManualChanges={hasManualChanges}
          amortisationDataYearly={yearlyAmortisationData}
          amortisationDataMonthly={monthlyAmortisationData}
          downloadAmortisation={downloadAmortisation}
          overrides={overrides}
          onApplyMonthChange={applyMonthChange}
          onResetMonthChange={clearMonthChange}
        />
      )}
    </div>
  );
};

export default CommonLoanCalculator;
