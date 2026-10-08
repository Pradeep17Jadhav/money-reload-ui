import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { sanitizeROI, toDecimal } from "@/helpers/numbers";
import {
  getUpdatedInterestRateWithValidation,
  getUpdatedNumberWithValidation,
} from "@/helpers/price";
import { CalculatorType, Tenure } from "@/types/ConfigTypes";
import { useMediaQuery, useTheme } from "@mui/material";
import {
  getMaximumInitialInvestment,
  getMaximumInvestment,
  getMinimumInvestment,
  MAX_ROI,
  MAX_STEP_UP,
  MIN_INVESTMENT,
  MIN_ROI,
} from "@/constants/calculator";
import {
  getDefaultInvestment,
  getDefaultROI,
  getDefaultStepUp,
  getDefaultTenure,
} from "./constants";
import { trackCalculateEvent } from "@/helpers/analytics";
import {
  fixedDepositValue,
  lumpsumValue,
  monthsIn,
  recurringDepositValue,
  sipValue,
} from "@/components/Common/CommonCalculator/helpers/returns";

type Props = {
  calculatorType: CalculatorType;
};

export const useCalculator = ({ calculatorType }: Props) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [isValidForm, setIsValidForm] = useState(false);
  const [resultsReady, setResultsReady] = useState(false);
  const [haveInitialInvestment, setHaveInitialInvestment] = useState(false);
  const [haveStepUp, setHaveStepUp] = useState(false);
  const [investment, setInvestment] = useState<number>(
    getDefaultInvestment(calculatorType)
  );
  const [stepUpPercentage, setStepUpPercentage] = useState<string>(
    getDefaultStepUp()
  );
  const [initialInvestment, setInitialInvestment] = useState<number>(0);
  const [totalInvestment, setTotalInvestment] = useState(0);
  const [roi, setRoi] = useState<string>(getDefaultROI(calculatorType));
  const [tenure, setTenure] = useState<Tenure>(
    getDefaultTenure(calculatorType)
  );
  const [profit, setProfit] = useState(0);
  const [maturityValue, setMaturityValue] = useState(0);
  const [timesMultiplied, setTimesMultiplied] = useState(0);

  const calculateTotalInvestment = useCallback(() => {
    if (!investment) {
      return;
    }
    // The month conversion is the shared one, so a three-year tenure plus a fortnight is the
    // same length of time here as it is in `/investments`.
    let totalInvested = investment * monthsIn(tenure);
    totalInvested += haveInitialInvestment ? initialInvestment : 0;
    setTotalInvestment(totalInvested);
  }, [
    haveInitialInvestment,
    initialInvestment,
    investment,
    tenure,
  ]);

  const calculateSIP = useCallback(() => {
    const totalMonths = monthsIn(tenure);
    const stepUp = parseFloat(stepUpPercentage);

    // Delegated, so this screen and the investments list cannot quote different SIP figures.
    const combinedMaturityValue = sipValue({
      monthlyAmount: investment,
      initialAmount: haveInitialInvestment ? initialInvestment : 0,
      rate: parseFloat(roi),
      tenure,
      stepUpPercent: haveStepUp && stepUp > 0 ? stepUp : 0,
    });

    const totalInvested = initialInvestment + investment * totalMonths;
    const updatedProfit = combinedMaturityValue - totalInvested;

    calculateTotalInvestment();
    setMaturityValue(combinedMaturityValue);
    setProfit(updatedProfit);
    setTimesMultiplied(toDecimal(combinedMaturityValue / totalInvested));
  }, [
    roi,
    tenure,
    stepUpPercentage,
    haveStepUp,
    initialInvestment,
    investment,
    haveInitialInvestment,
    calculateTotalInvestment,
  ]);

  const calculateFD = useCallback(() => {
    /*
     * Quarterly, as an FD always is — passed in rather than baked into the helper, because
     * `/investments` lets the user state the frequency and must reach the same helper.
     */
    const maturityValue = fixedDepositValue({
      amount: investment,
      rate: parseFloat(roi),
      tenure,
      compoundingsPerYear: 4,
    });
    const profit = maturityValue - investment;

    setMaturityValue(maturityValue);
    setProfit(profit);
    setTimesMultiplied(toDecimal(maturityValue / investment));
  }, [tenure, roi, investment]);

  const calculateRD = useCallback(() => {
    // A deposit every month, compounded quarterly, as an RD always is.
    const totalMaturityValue = recurringDepositValue({
      monthlyAmount: investment,
      initialAmount: initialInvestment,
      rate: parseFloat(roi),
      tenure,
      compoundingsPerYear: 4,
    });
    const totalInvestment = initialInvestment + investment * monthsIn(tenure);
    const profit = totalMaturityValue - totalInvestment;

    setMaturityValue(Math.round(totalMaturityValue));
    setProfit(Math.round(profit));
    setTotalInvestment(totalInvestment);
    setTimesMultiplied(toDecimal(totalMaturityValue / totalInvestment));
  }, [tenure, roi, initialInvestment, investment]);

  const calculateLumpsum = useCallback(() => {
    /*
     * Compounded monthly, as this calculator has always quoted. Note this is not the same as
     * quarterly: an annual rate split twelve ways and compounded twelve times is a different
     * sum from one split four ways and compounded four times. Left exactly as it was.
     */
    const maturityValue = lumpsumValue({
      amount: investment,
      rate: parseFloat(roi),
      tenure,
      compoundingsPerYear: 12,
    });
    const profit = maturityValue - investment;

    setMaturityValue(maturityValue);
    setProfit(profit);
    setTimesMultiplied(toDecimal(maturityValue / investment));
  }, [roi, tenure, investment]);

  const calculate = useCallback(() => {
    switch (calculatorType) {
      case CalculatorType.SIP: {
        calculateSIP();
        break;
      }
      case CalculatorType.FD: {
        calculateFD();
        break;
      }
      case CalculatorType.RD: {
        calculateRD();
        break;
      }
      case CalculatorType.LUMPSUM: {
        calculateLumpsum();
        break;
      }
    }
    trackCalculateEvent(calculatorType);
    setResultsReady(true);
  }, [
    calculateSIP,
    calculateLumpsum,
    calculateFD,
    calculateRD,
    calculatorType,
  ]);

  const handleInitialInvestmentChange = useCallback(
    (
      e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      initialInvestment?: string
    ) => {
      const investment = e?.target.value || initialInvestment || "0";
      const maximumInvestment = getMaximumInitialInvestment();
      setInitialInvestment((currInvestment) =>
        getUpdatedNumberWithValidation(
          investment,
          currInvestment,
          true,
          MIN_INVESTMENT,
          maximumInvestment
        )
      );
    },
    []
  );

  const handleInvestmentChange = useCallback(
    (
      e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      investment?: string
    ) => {
      const newInvestment = e?.target.value || investment || "0";
      const maximumInvestment = getMaximumInvestment(calculatorType);
      const minimumInvestment = getMinimumInvestment(calculatorType);
      setInvestment((currInvestment) =>
        getUpdatedNumberWithValidation(
          newInvestment,
          currInvestment,
          true,
          minimumInvestment,
          maximumInvestment
        )
      );
    },
    [calculatorType]
  );

  const handleROIChange = useCallback(
    (e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, roi?: string) => {
      const newROI = e?.target.value || roi || "";
      const sanitizedROI = sanitizeROI(newROI);
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
      const newTenureMonths = e?.target.value || months || "0";
      setTenure((tenure) => ({
        ...tenure,
        months: getUpdatedNumberWithValidation(
          newTenureMonths,
          tenure.months,
          false,
          0,
          11
        ),
      }));
    },
    []
  );

  const handleStepUpChange = useCallback(
    (
      e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      stepUp?: string
    ) => {
      const newStepUp = e?.target.value || stepUp || "";
      const sanitizedStepUp = sanitizeROI(newStepUp);
      setStepUpPercentage((currStepUp) =>
        getUpdatedInterestRateWithValidation(
          sanitizedStepUp,
          currStepUp,
          MIN_ROI,
          MAX_STEP_UP
        )
      );
    },
    []
  );

  useEffect(() => {
    setResultsReady(false);
    calculateTotalInvestment();
    if (!investment || !roi || (!tenure.months && !tenure.years)) {
      setIsValidForm(false);
      setMaturityValue(0);
      setProfit(0);
      setTimesMultiplied(0);
      return;
    }
    setIsValidForm(true);
    if (!isMobile) {
      calculate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    haveStepUp,
    haveInitialInvestment,
    initialInvestment,
    investment,
    roi,
    stepUpPercentage,
    tenure,
  ]);

  return {
    isValidForm,
    resultsReady,
    initialInvestment,
    investment,
    yearlyInvestment: investment * 12,
    totalInvestment,
    roi,
    tenure,
    profit,
    maturityValue,
    timesMultiplied,
    haveInitialInvestment,
    stepUpPercentage,
    haveStepUp,
    setHaveStepUp,
    handleStepUpChange,
    setHaveInitialInvestment,
    calculate,
    handleInitialInvestmentChange,
    handleInvestmentChange,
    handleROIChange,
    handleTenureYearsChange,
    handleTenureMonthsChange,
  };
};
