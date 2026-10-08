import { LoanCalculatorType } from "@/types/ConfigTypes";
import CommonLoanCalculator from "@/components/Common/LoanCalculator/CommonLoanCalculator/CommonLoanCalculator";
import LoanCalculatorSummary from "@/components/Loan/LoanCalculatorSummary";
import MortgagePageInformation from "@/components/Loan/PageInformation/Morgage/MortgagePageInformation";
import { PrepaymentsProvider } from "@/contexts/loan/prepaymentsContext";
import { SavedCalculationsProvider } from "@/contexts/loan/savedCalculationsContext";

import styles from "./MortgagePage.module.css";

const MortgagePage = async () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Mortgage Calculator</h1>
      <h2 className={styles.pageSubtitle}>
        Calculate Home Loan, Mortgage, and Refinance Options With Prepayment
      </h2>
      <SavedCalculationsProvider>
        <PrepaymentsProvider>
          <CommonLoanCalculator
            loanCalculatorType={LoanCalculatorType.HOME}
            Summary={LoanCalculatorSummary}
          />
        </PrepaymentsProvider>
      </SavedCalculationsProvider>
      <MortgagePageInformation />
    </div>
  );
};

export default MortgagePage;
