"use client";

import { ChangeEvent } from "react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import Section from "@/components/Section/Section";
import { useAmountSelection } from "@/hooks/Loan/useLoanSelection";
import { LoanCalculatorType, Tenure } from "@/types/ConfigTypes";
import {
  defaultLoanTenureYears,
  labels,
  defaultLoanInterestRates,
  defaultLoanTenureMonths,
  defaultLoanAmount,
} from "./constants";
import InputElement from "../../InputElement/InputElement";
import TenureInputElement from "../../TenureInputElement/TenureInputElement";
import LargeButton from "@/components/Buttons/LargeButton/LargeButton";
import { useMediaQuery, useTheme } from "@mui/material";
import PrepaymentInputElement from "@/components/Loan/PrepaymentInputElement/PrepaymentInputElement";

import styles from "./CommonLoanCalculatorInput.module.css";

type Props = {
  loanCalculatorType: LoanCalculatorType;
  loanAmount: number;
  roi: string;
  tenure: Tenure;
  /** The month the loan begins, which every date in the schedule is built from. */
  startMonth: Dayjs;
  isValidForm: boolean;
  minAmount: number;
  maxAmount: number;
  stepAmount: number;
  minRoi: number;
  maxRoi: number;
  stepRoi: number;
  calculate: () => void;
  handleLoanAmountChange: (
    e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    amount?: string
  ) => void;
  handleROIChange: (
    e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    roi?: string
  ) => void;
  handleTenureYearsChange: (
    e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    years?: string
  ) => void;
  handleTenureMonthsChange: (
    e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    months?: string
  ) => void;
  handleStartMonthChange: (value: Dayjs | null) => void;
  getLoanAmountScale: (value: number) => number;
  getLoanAmountInverseScale: (value: number) => number;
  onSaveCalculations: () => void;
};

const CommonLoanCalculatorInput = ({
  loanCalculatorType,
  loanAmount,
  roi,
  tenure,
  startMonth,
  isValidForm,
  minAmount,
  maxAmount,
  stepAmount,
  minRoi,
  maxRoi,
  stepRoi,
  calculate,
  handleLoanAmountChange,
  handleROIChange,
  handleTenureYearsChange,
  handleTenureMonthsChange,
  handleStartMonthChange,
  getLoanAmountScale,
  getLoanAmountInverseScale,
  onSaveCalculations,
}: Props) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    isActiveLoanAmountButton,
    isActiveYearButton,
    isActiveMonthButton,
    isActiveROIButton,
    selectLoanAmount,
    selectYears,
    selectMonths,
    selectROI,
  } = useAmountSelection({
    loanAmount,
    tenure,
    roi,
    handleLoanAmountChange,
    handleROIChange,
    handleTenureYearsChange,
    handleTenureMonthsChange,
  });

  return (
    <Section title={labels[loanCalculatorType].title}>
      <InputElement
        value={loanAmount}
        buttonsData={defaultLoanAmount}
        label={labels[loanCalculatorType].loanAmount}
        placeholder={labels[loanCalculatorType].loanAmountPlaceholder}
        isPrice={true}
        handleChange={handleLoanAmountChange}
        isActiveShortcutButton={isActiveLoanAmountButton}
        selectShortcutButton={selectLoanAmount}
        getScale={getLoanAmountScale}
        getInverseScale={getLoanAmountInverseScale}
        step={stepAmount}
        min={minAmount}
        max={maxAmount}
      />

      <InputElement
        value={roi}
        buttonsData={defaultLoanInterestRates}
        label={labels[loanCalculatorType].roi}
        placeholder={labels[loanCalculatorType].roiPlaceholder}
        handleChange={handleROIChange}
        isActiveShortcutButton={isActiveROIButton}
        selectShortcutButton={selectROI}
        isROI
        step={stepRoi}
        min={minRoi}
        max={maxRoi / 4}
      />

      <TenureInputElement
        tenure={tenure}
        label={labels[loanCalculatorType].tenure}
        placeholderYears={labels[loanCalculatorType].tenureYearsPlaceholder}
        placeholderMonths={labels[loanCalculatorType].tenureMonthsPlaceholder}
        yearsData={defaultLoanTenureYears}
        monthsData={defaultLoanTenureMonths}
        handleYearChange={handleTenureYearsChange}
        handleMonthChange={handleTenureMonthsChange}
        isActiveYearButton={isActiveYearButton}
        isActiveMonthButton={isActiveMonthButton}
        selectYears={selectYears}
        selectMonths={selectMonths}
        showMonths
      />

      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className={styles.startMonthField} data-testid="loan-start-month">
          <DatePicker
            label="Start month"
            // Month granularity: the schedule is built in whole months, so offering
            // a day would imply a precision the calculation does not have.
            views={["month", "year"]}
            value={startMonth}
            onChange={handleStartMonthChange}
            maxDate={dayjs().endOf("month")}
            slotProps={{
              textField: { size: "small", fullWidth: true },
              field: { clearable: false },
            }}
          />
        </div>
      </LocalizationProvider>

      <PrepaymentInputElement onSaveCalculations={onSaveCalculations} />

      {isMobile && (
        <LargeButton onClick={calculate} disabled={!isValidForm} centered>
          CALCULATE
        </LargeButton>
      )}
    </Section>
  );
};

export default CommonLoanCalculatorInput;
