"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TwoColumnContainer from "@/components/Common/TwoColumnContainer/TwoColumnContainer";
import { useLoanCalculator } from "@/hooks/Loan/useLoanCalculator";
import { LoanCalculatorType } from "@/types/ConfigTypes";
import { LoanCalculatorProps } from "@/components/Loan/LoanCalculatorSummary";
import { useLoanAmortisation } from "@/hooks/Loan/useLoanAmortisation";
import LoanAmortisation from "../LoanAmortisation/LoanAmortisation";
import CommonLoanCalculatorInput from "../CommonLoanCalculatorInput/CommonLoanCalculatorInput";
import { usePrepayment } from "@/hooks/Loan/usePrepayments";
import { expandPrepayments, getLoanSignature } from "@/hooks/Loan/usePrepayments";
import { usePrepaymentsProvider } from "@/contexts/loan/prepaymentsContext";
import { PrepaymentsActionType } from "@/contexts/loan/prepaymentsContext";
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
import SaveCalculationDialog from "@/components/Loan/SaveCalculationDialog/SaveCalculationDialog";
import type { SaveCalculationValues } from "@/components/Loan/SaveCalculationDialog/SaveCalculationDialog";
import { buildCalculationPayload, toCalculationDraft } from "../helpers/calculationPayload";
import { createCalculation } from "@/services/loan/calculations";
import { useSavedCalculationsProvider } from "@/contexts/loan/savedCalculationsContext";
import { useAuth } from "@/contexts/authContext";
import { getAuthErrorCopy } from "@/helpers/apiErrors";
import type { SavedLoanCalculation } from "@/types/Loan/CalculationTypes";

import styles from "./CommonLoanCalculator.module.css";
import { useCurrency } from "@/contexts/currency";

type Props = {
  loanCalculatorType: LoanCalculatorType;
  Summary: React.ComponentType<LoanCalculatorProps>;
};

const CommonLoanCalculator = ({ loanCalculatorType, Summary }: Props) => {
  const { currency } = useCurrency();
  const { authorisedRequest } = useAuth();
  const {
    refetch: refetchCalculations,
    pendingCalculation,
    clearPendingCalculation,
  } = useSavedCalculationsProvider();
  const resultRef = useRef<HTMLDivElement>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [saveFieldErrors, setSaveFieldErrors] = useState<Record<string, string>>(
    {}
  );
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
    applyScenario,
  } = useLoanCalculator({ loanCalculatorType });

  const { prepayments, dispatch } = usePrepaymentsProvider();
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
    applyMonthChanges,
    clearMonthChange,
  } = useLoanAmortisation(
    loanAmount,
    roi,
    tenure,
    prepaymentsByMonth,
    hasPrepayments,
    startMonth
  );

  /**
   * Loads a saved scenario over the current one, replacing every input it covers.
   *
   * One pass, not three: the loan terms, the prepayments and the month changes all
   * come from the same scenario, and applying them in separate renders would put the
   * schedule through intermediate loans that the user never saved and never saw.
   *
   * The month changes are installed *after* the terms and prepayments, and tagged
   * with the fingerprint of the loan they describe — `useLoanAmortisation` clears
   * month changes whenever the loan changes, and without the tag the restore's own
   * changes would be discarded on the render that installs them.
   */
  const handleApplyCalculation = useCallback(
    (calculation: SavedLoanCalculation) => {
      const draft = toCalculationDraft(calculation);

      /*
       * The fingerprint is computed from the scenario itself rather than from the loan
       * currently on screen, because the loan about to be installed *is* the one these
       * month changes describe. `useLoanAmortisation` keeps the changes while the loan
       * still matches this and drops them the moment it stops doing so.
       */
      const signature = getLoanSignature({
        loanAmount: draft.loanAmount,
        roi: draft.roi,
        tenure: draft.tenure,
        prepaymentsByMonth: expandPrepayments({
          prepayments: draft.prepayments,
          tenure: draft.tenure,
          startMonth: draft.startMonth,
        }),
      });

      dispatch({
        type: PrepaymentsActionType.REPLACE_PREPAYMENTS,
        prepayments: draft.prepayments,
      });
      applyScenario({
        currency: draft.currency,
        terms: {
          loanAmount: draft.loanAmount,
          roi: draft.roi,
          tenure: draft.tenure,
          startMonth: draft.startMonth,
        },
      });
      applyMonthChanges(draft.overrides, signature);
    },
    [applyMonthChanges, applyScenario, dispatch]
  );

  /*
   * Applied from an effect rather than from the dropdown's own handler: the dropdown and
   * the calculator are siblings, so the scenario travels through the provider and this is
   * the only place that can put it into calculator state.
   */
  useEffect(() => {
    if (!pendingCalculation) {
      return;
    }

    handleApplyCalculation(pendingCalculation);
    clearPendingCalculation();
  }, [clearPendingCalculation, handleApplyCalculation, pendingCalculation]);

  const handleCalculateBtnClick = useCallback(
    (valid?: boolean) => {
      calculate(valid);
      resultRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    },
    [calculate]
  );

  const handleOpenSaveDialog = useCallback(() => {
    setSaveBanner(null);
    setSaveFieldErrors({});
    setIsSaveDialogOpen(true);
  }, []);

  const handleCloseSaveDialog = useCallback(() => {
    setIsSaveDialogOpen(false);
  }, []);

  const handleSaveCalculation = useCallback(
    async ({ name, description }: SaveCalculationValues) => {
      const payload = buildCalculationPayload(
        {
          loanCalculatorType,
          currency,
          loanAmount,
          roi,
          tenure,
          startMonth,
          prepayments,
          overrides,
        },
        { name, description }
      );

      if (!payload) {
        return;
      }

      setIsSaving(true);
      setSaveBanner(null);
      setSaveFieldErrors({});

      try {
        await createCalculation(authorisedRequest, payload);
        /*
         * Closed on success only. A rejection leaves the dialog open with the
         * typed name intact, so one rejected field costs a correction rather
         * than the whole form.
         */
        setIsSaveDialogOpen(false);
        refetchCalculations();
      } catch (thrown) {
        const copy = getAuthErrorCopy(thrown);
        setSaveBanner(copy.banner);
        setSaveFieldErrors(copy.fields);
      } finally {
        setIsSaving(false);
      }
    },
    [
      authorisedRequest,
      currency,
      loanAmount,
      loanCalculatorType,
      overrides,
      prepayments,
      refetchCalculations,
      roi,
      startMonth,
      tenure,
    ]
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
        onSaveCalculations={handleOpenSaveDialog}
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
      handleOpenSaveDialog,
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

      <SaveCalculationDialog
        open={isSaveDialogOpen}
        isSaving={isSaving}
        banner={saveBanner}
        errors={saveFieldErrors}
        onClose={handleCloseSaveDialog}
        onSubmit={(values) => {
          void handleSaveCalculation(values);
        }}
      />
    </div>
  );
};

export default CommonLoanCalculator;
