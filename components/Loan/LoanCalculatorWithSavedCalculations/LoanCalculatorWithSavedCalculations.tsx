"use client";

import CommonLoanCalculator from "@/components/Common/LoanCalculator/CommonLoanCalculator/CommonLoanCalculator";
import LoanCalculatorSummary from "@/components/Loan/LoanCalculatorSummary";
import SavedCalculationsSelect from "@/components/Loan/SavedCalculationsSelect/SavedCalculationsSelect";
import { PrepaymentsProvider } from "@/contexts/loan/prepaymentsContext";
import { useSavedCalculationsProvider } from "@/contexts/loan/savedCalculationsContext";
import { LoanCalculatorType } from "@/types/ConfigTypes";

import styles from "./LoanCalculatorWithSavedCalculations.module.css";

/**
 * The dropdown and the calculator it drives, on one client boundary.
 *
 * They have to be in the same React tree to share a context, but only the calculator
 * is interactive, so this wrapper is what the page renders — the dropdown above, the
 * calculator below, and the provider around both. A server component cannot hold the
 * selection, which is why the page does not compose these two directly.
 *
 * The subtitle deliberately sits between them, so the dropdown reads as part of the
 * page heading rather than as a toolbar bolted onto the calculator.
 */
const LoanCalculatorWithSavedCalculations = ({
  subtitle,
}: {
  subtitle: string;
}) => {
  // Read here so the provider above is definitely mounted for this subtree; the value
  // itself belongs to the dropdown and the calculator, not to this shell.
  useSavedCalculationsProvider();

  return (
    <>
      <div className={styles.savedCalculations}>
        <SavedCalculationsSelect />
      </div>

      <h2 className={styles.subtitle}>{subtitle}</h2>

      <PrepaymentsProvider>
        <CommonLoanCalculator
          loanCalculatorType={LoanCalculatorType.HOME}
          Summary={LoanCalculatorSummary}
        />
      </PrepaymentsProvider>
    </>
  );
};

export default LoanCalculatorWithSavedCalculations;