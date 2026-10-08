import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import {
  getUpdatedInterestRateWithValidation,
  getUpdatedNumberWithValidation,
} from "@/helpers/price";
import { Tenure, LoanCalculatorType } from "@/types/ConfigTypes";
import { sanitizeROI, toDecimal } from "@/helpers/numbers";
import { useMediaQuery, useTheme } from "@mui/material";
import { MAX_ROI, MIN_LOAN_AMOUNT, MIN_ROI } from "@/constants/calculator";
import { trackCalculateEvent } from "@/helpers/analytics";
import { getDefaultLoanValues } from "./constants";
import { useCurrency } from "@/contexts/currency";
import type { Currency } from "@/contexts/currency";
import { getMaxLoanAmountByCurrency } from "@/components/Common/LoanCalculator/CommonLoanCalculator/constants";

type Props = {
  loanCalculatorType: LoanCalculatorType;
};

/** The four terms a loan is defined by, applied together when restoring a scenario. */
export type LoanTerms = {
  loanAmount: number;
  /** A string, because that is what the rate input holds while it is being typed. */
  roi: string;
  tenure: Tenure;
  startMonth: Dayjs;
};

const initialTenure = {
  years: 20,
  months: 0,
  days: 0,
};

export const useLoanCalculator = ({ loanCalculatorType }: Props) => {
  const theme = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { defaultLoanAmount, defaultRoi } = getDefaultLoanValues(
    loanCalculatorType,
    currency
  );
  /** See {@link applyScenario}. A ref, so arming it never schedules a render. */
  const isRestoringRef = useRef(false);
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [resultsReady, setResultsReady] = useState(false);
  const [isValidForm, setIsValidForm] = useState(false);
  const [loanAmount, setLoanAmount] = useState<number>(defaultLoanAmount);
  const [totalPayment, setTotalPayment] = useState(0);
  const [roi, setRoi] = useState<string>(defaultRoi);
  const [emi, setEmi] = useState(0);
  const [tenure, setTenure] = useState<Tenure>(initialTenure);
  const [interestPaid, setInterestPaid] = useState(0);
  const [timesPaid, setTimesPaid] = useState(0);
  /**
   * The month the loan begins. A loan taken out earlier than today still needs a
   * schedule, so this drives the amortisation, the prepayments and the dates shown
   * in the summary rather than assuming the current month.
   */
  const [startMonth, setStartMonth] = useState<Dayjs>(dayjs().startOf("month"));

  const calculateLoan = useCallback(() => {
    const monthlyRate = parseFloat(roi) / 12 / 100;
    const totalMonths = tenure.years * 12 + tenure.months;

    const emi =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
      (Math.pow(1 + monthlyRate, totalMonths) - 1);
    const totalPayment = emi * totalMonths;
    const totalInterest = totalPayment - loanAmount;
    const timesPaid = totalPayment / loanAmount;

    setEmi(emi);
    setInterestPaid(Math.round(totalInterest));
    setIsValidForm(true);
    setLoanAmount(loanAmount);
    setTimesPaid(toDecimal(timesPaid));
    setTotalPayment(toDecimal(totalPayment));
    setRoi(roi);
    setTenure(tenure);
  }, [loanAmount, roi, tenure]);

  const calculate = useCallback(
    (valid?: boolean) => {
      if (!isValidForm && !valid) return;

      switch (loanCalculatorType) {
        case LoanCalculatorType.HOME: {
          calculateLoan();
          break;
        }
        case LoanCalculatorType.CAR: {
          calculateLoan();
          break;
        }
        case LoanCalculatorType.PERSONAL: {
          calculateLoan();
          break;
        }
      }
      trackCalculateEvent(LoanCalculatorType.COMMON);
      setResultsReady(true);
    },
    [calculateLoan, isValidForm, loanCalculatorType]
  );

  const handleLoanAmountChange = useCallback(
    (
      e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      amount?: string
    ) => {
      const newInvestment = e?.target.value || amount || "0";
      setLoanAmount((currInvestment) =>
        getUpdatedNumberWithValidation(
          newInvestment,
          currInvestment,
          true,
          MIN_LOAN_AMOUNT,
          getMaxLoanAmountByCurrency(currency)
        )
      );
    },
    [currency]
  );

  const handleROIChange = useCallback(
    (e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, roi?: string) => {
      const newROIInput = e?.target.value || roi || "";
      const sanitizedROI = sanitizeROI(newROIInput);
      setRoi((currROI) =>
        getUpdatedInterestRateWithValidation(
          sanitizedROI,
          currROI,
          MIN_ROI,
          MAX_ROI
        )
      );
    },
    []
  );

  const handleTenureYearsChange = useCallback(
    (
      e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      years?: string
    ) => {
      const newTenureYears = e?.target.value || years || "0";
      setTenure((tenure) => ({
        ...tenure,
        years: getUpdatedNumberWithValidation(
          newTenureYears,
          tenure.years,
          false,
          0,
          100
        ),
      }));
    },
    []
  );

  const handleTenureMonthsChange = useCallback(
    (
      e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      months?: string
    ) => {
      const newInvestmentPeriod = e?.target.value || months || "0";
      setTenure((tenure) => ({
        ...tenure,
        months: getUpdatedNumberWithValidation(
          newInvestmentPeriod,
          tenure.months,
          false,
          0,
          11
        ),
      }));
    },
    []
  );

  const handleStartMonthChange = useCallback((value: Dayjs | null) => {
    if (!value) {
      return;
    }
    // Normalised to the first of the month, so a day picked mid-month cannot
    // shift the schedule by a few weeks.
    setStartMonth(value.startOf("month"));
  }, []);

  /**
   * Replaces the loan terms, and the currency they were quoted in, in one go.
   *
   * One callback rather than five calls because a scenario has to land whole. Setting
   * them one at a time would run the calculation effect on each partial loan, so the
   * summary would briefly show a 20-year EMI on a loan about to become a 7-year one.
   */
  const applyScenario = useCallback(
    (scenario: { currency: Currency; terms: LoanTerms }) => {
      const isCurrencyChanging = scenario.currency !== currency;

      /*
       * Marked *before* the state changes, because changing the currency re-runs the
       * effect that resets the amount and the rate to that currency's defaults — and
       * that reset must not land on the terms being restored. Marked only when the
       * currency really moves, so the flag cannot outlive the one effect run it exists
       * to disarm.
       */
      isRestoringRef.current = isCurrencyChanging;

      if (isCurrencyChanging) {
        setCurrency(scenario.currency);
      }

      setLoanAmount(scenario.terms.loanAmount);
      setRoi(scenario.terms.roi);
      setTenure(scenario.terms.tenure);
      setStartMonth(scenario.terms.startMonth);
    },
    [currency, setCurrency]
  );

  useEffect(() => {
    if (isRestoringRef.current) {
      // This run is a restored scenario's own currency change talking, not the user
      // picking a currency off the navbar, so the defaults must not overwrite it.
      isRestoringRef.current = false;
      return;
    }
    setRoi(defaultRoi);
    setLoanAmount(defaultLoanAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, loanCalculatorType]);

  useEffect(() => {
    setResultsReady(false);
    if (!loanAmount || !parseFloat(roi) || (!tenure.months && !tenure.years)) {
      setIsValidForm(false);
      setTotalPayment(0);
      setEmi(0);
      setInterestPaid(0);
      setTimesPaid(0);
      return;
    }
    setIsValidForm(true);
    if (!isMobile) {
      calculate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanAmount, roi, tenure]);

  return {
    resultsReady,
    isValidForm,
    loanAmount,
    totalPaid: totalPayment,
    roi,
    tenure,
    interestPaid,
    timesPaid,
    emi,
    startMonth,
    calculate,
    handleLoanAmountChange,
    handleROIChange,
    handleTenureYearsChange,
    handleTenureMonthsChange,
    handleStartMonthChange,
    applyScenario,
  };
};
