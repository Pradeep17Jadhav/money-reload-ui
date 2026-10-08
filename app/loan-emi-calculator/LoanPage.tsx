import { getConfig } from "@/helpers/config";
import { Config } from "@/types/ConfigTypes";
import LoanPageInformation from "@/components/Loan/LoanPageInformation";
import FAQs from "@/components/Common/FAQs/FAQs";
import { SavedCalculationsProvider } from "@/contexts/loan/savedCalculationsContext";
import LoanCalculatorWithSavedCalculations from "@/components/Loan/LoanCalculatorWithSavedCalculations/LoanCalculatorWithSavedCalculations";

import styles from "./LoanPage.module.css";

const LoanPage = async () => {
  const config: Config = await getConfig();
  const { loanEMI } = config;
  const faqs = loanEMI.faqs || [];

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Loan EMI and Tenure Calculator</h1>
      <SavedCalculationsProvider>
        <LoanCalculatorWithSavedCalculations subtitle="Calculate Home, Personal & Car Loans With Prepayment" />
      </SavedCalculationsProvider>
      <LoanPageInformation />
      <FAQs faqs={faqs} />
    </div>
  );
};

export default LoanPage;