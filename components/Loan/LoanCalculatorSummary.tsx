"use client";

import { Ref, useMemo } from "react";
import { ToWords } from "to-words";
import Section from "@/components/Section/Section";
import SummaryBlock from "@/components/Summary/SummaryBlock/SummaryBlock";
import SummaryItem from "@/components/Summary/SummaryItem/SummaryItem";
import AmountBanner from "@/components/Summary/AmountBanner/AmountBanner";
import { getPrintableMonthYear } from "../Common/LoanCalculator/helpers/loan";
import { AmortisationTableFrequency } from "@/types/Loan/LoanTypes";
import { toDecimal } from "@/helpers/numbers";
import ProgressChart, { BarData } from "../Charts/ProgressChart";
import { useCurrency } from "@/contexts/currency";

import styles from "./LoanCalculatorSummary.module.css";

export type LoanCalculatorProps = {
  resultsReady: boolean;
  isValidForm: boolean;
  hasPrepayments: boolean;
  /** True once a month of the schedule has been edited by hand. */
  hasManualChanges?: boolean;
  loanAmount: number;
  roi: string;
  totalPaid: number;
  principalPaid: number;
  interestPaid: number;
  prepayments: number;
  prepaymentSavings: number;
  timesMultiplied: number;
  emi: number;
  starts: number;
  ends: number;
  ref?: Ref<HTMLDivElement>;
};

const LoanCalculatorSummary = ({
  resultsReady,
  isValidForm,
  hasPrepayments,
  hasManualChanges = false,
  loanAmount,
  roi,
  totalPaid,
  principalPaid,
  interestPaid,
  prepaymentSavings,
  prepayments,
  timesMultiplied,
  emi,
  starts,
  ends,
  ref,
}: LoanCalculatorProps) => {
  const { formatAmount } = useCurrency();
  const toWords = new ToWords();

  const barsData: BarData[] = useMemo(
    () => [
      {
        label: "Loan Amount",
        fill: "var(--primary-blue)",
        value: loanAmount,
      },
      {
        label: "Prepayments",
        fill: "var(--profit)",
        value: prepayments,
      },
      {
        label: "Interest",
        fill: "var(--loss)",
        value: interestPaid,
      },
    ],
    [interestPaid, loanAmount, prepayments]
  );

  return (
    <div className={styles.container}>
      <Section ref={ref} autoHeight>
        <AmountBanner amount={emi} prefix="EMI " />
      </Section>
      <Section title="Summary of Loan">
        {resultsReady && isValidForm && (
          <SummaryBlock title="Loan Details">
            <SummaryItem
              left="Loan Amount"
              right={formatAmount(resultsReady ? loanAmount : 0)}
            />
            <SummaryItem left="Rate of Interest" right={`${roi}%`} />
            <SummaryItem
              left="Start Date"
              right={getPrintableMonthYear(
                AmortisationTableFrequency.Monthly,
                starts,
                true
              )}
            />
            <SummaryItem
              left="End Date"
              right={getPrintableMonthYear(
                AmortisationTableFrequency.Monthly,
                ends,
                true
              )}
            />
          </SummaryBlock>
        )}
        <SummaryBlock title="Repayment Details">
          <SummaryItem
            left="Total Prepayments"
            right={formatAmount(prepayments)}
            tooltip={toWords.convert(prepayments)}
          />
          <SummaryItem
            left="Principal Payable"
            right={formatAmount(resultsReady ? principalPaid : 0)}
            tooltip={toWords.convert(principalPaid)}
          />
          <SummaryItem
            left="Interest Payable"
            right={formatAmount(interestPaid)}
            loss={!!interestPaid}
            tooltip={toWords.convert(interestPaid)}
          />
          <SummaryItem
            left="Total Repayment"
            right={formatAmount(totalPaid)}
            tooltip={toWords.convert(totalPaid)}
          />
          <SummaryItem
            left="Loan Amount Multiplied By"
            right={`${timesMultiplied} times`}
          />
          {hasPrepayments && (
            <SummaryItem
              left="Savings with Prepayments"
              right={formatAmount(prepaymentSavings)}
              profit
              tooltip={toWords.convert(toDecimal(prepaymentSavings, 0))}
            />
          )}
          {hasManualChanges && (
            <SummaryItem
              left="Schedule changed by hand"
              right="Included above"
              tooltip="Totals include the months you edited."
            />
          )}
        </SummaryBlock>
        <ProgressChart
          show={resultsReady}
          id="loanCalculator"
          barsData={barsData}
        />
      </Section>
    </div>
  );
};

export default LoanCalculatorSummary;
