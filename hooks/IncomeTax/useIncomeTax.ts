import { useCallback, useEffect, useState } from "react";
import {
  calculateOtherTaxes,
  getTotalTaxFromOtherTaxes,
} from "@/components/IncomeTax/helpers";
import { splitTaxAcrossSlabs } from "@/components/IncomeTax/helpers/slabSplit";
import { convertPriceToInt, isInputStringAValidNumber } from "@/helpers/price";
import { Budget, CalculatedTaxSlab, ITOtherTax } from "@/types/ConfigTypes";
import { useMediaQuery, useTheme } from "@mui/material";
import { MAX_INCOME } from "@/constants/calculator";

export const useIncomeTax = (
  budget: Budget,
  additionalIncomeTotal = 0
) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [resultsReady, setResultsReady] = useState(false);
  const { standardDeduction, slabs, rebate, taxes } = budget;
  const { applyMarginalRelief } = budget;
  const [isValidForm, setIsValidForm] = useState(false);
  const [income, setIncome] = useState(0);
  const [marginalRelief, setMarginalRelief] = useState(0);
  const [useStandardDeduction, setUseStandardDeduction] = useState(true);
  const [applicableRebate, setApplicableRebate] = useState(0);
  const [totalIncomeTax, setTotalIncomeTax] = useState(0);
  const [incomeAfterDeductions, setIncomeAfterDeductions] = useState(0);
  const [applicableTaxSlabs, setApplicableTaxSlabs] = useState<
    CalculatedTaxSlab[]
  >([]);
  const [otherTaxes, setOtherTaxes] = useState<ITOtherTax[]>([]);

  const toggleStdDeduction = useCallback(() => {
    setUseStandardDeduction((apply) => !apply);
  }, []);

  const calculateIncomeTax = useCallback(
    (income: number) => {
      resetBeforeCalculate();
      const stdDeducation = useStandardDeduction ? standardDeduction.amount : 0;
      const incomeAfterDeductions = income - stdDeducation;
      setIncomeAfterDeductions(incomeAfterDeductions);

      /*
       * The salary takes the lower slabs first and the additional income only reaches what is
       * left, so the two are charged against the bands in one walk rather than taxed separately
       * and added — which would charge both at the top of the scale and understate the bill.
       */
      const { mainTax, additionalTax, rows } = splitTaxAcrossSlabs(
        slabs,
        incomeAfterDeductions,
        additionalIncomeTotal
      );
      setApplicableTaxSlabs(rows);
      const applicableTax = mainTax + additionalTax;

      /*
       * The rebate ceiling and marginal relief both measure the income, so they see the two as
       * the one figure the taxpayer actually has.
       */
      const taxableIncome = incomeAfterDeductions + additionalIncomeTotal;

      let applicableRebate = 0;
      let marginalRelief = 0;
      if (taxableIncome <= rebate.amount) {
        setApplicableRebate(applicableTax);
        applicableRebate = applicableTax;
      } else {
        setApplicableRebate(0);
        const incomeOverRebate = taxableIncome - rebate.amount;
        if (applyMarginalRelief && applicableTax > incomeOverRebate) {
          marginalRelief = applicableTax - incomeOverRebate;
          setMarginalRelief(applicableTax - incomeOverRebate);
        }
      }

      const taxBeforeOtherTaxes =
        applicableTax - applicableRebate - marginalRelief;
      const otherTaxes = calculateOtherTaxes(taxBeforeOtherTaxes, taxes);
      const otherTaxesSum = getTotalTaxFromOtherTaxes(otherTaxes);
      setOtherTaxes(otherTaxes);
      setTotalIncomeTax(taxBeforeOtherTaxes + otherTaxesSum);
      setResultsReady(true);
    },
    [
      additionalIncomeTotal,
      applyMarginalRelief,
      rebate.amount,
      slabs,
      standardDeduction.amount,
      taxes,
      useStandardDeduction,
    ]
  );

  const onIncomeChange = useCallback(
    (newIncome: string) => {
      setResultsReady(false);
      const isValid = isInputStringAValidNumber(newIncome);
      setIsValidForm(isValid);
      if (!isValid) {
        return;
      }
      const applicableIncome = Math.min(
        convertPriceToInt(newIncome),
        MAX_INCOME
      );
      setIncome(applicableIncome);
      if (!isMobile) {
        calculateIncomeTax(applicableIncome);
      }
    },
    [calculateIncomeTax, isMobile]
  );

  const resetBeforeCalculate = () => {
    setMarginalRelief(0);
    setApplicableTaxSlabs([]);
    setApplicableRebate(0);
  };

  /**
   * Re-derives the figures whenever the additional income changes.
   *
   * The tax depends on the total, so leaving the recalculation to the caller means every place
   * that adds or removes a line has to remember to press CALCULATE — and a forgotten one leaves
   * the summary quietly showing the figures from before the line existed. Owning it here is what
   * makes "the additional income is part of the calculation" true by construction rather than by
   * everyone remembering.
   *
   * Guarded so it cannot run against an empty form: there is nothing to tax yet, and the mobile
   * layout waits for an explicit CALCULATE anyway.
   */
  useEffect(() => {
    if (isMobile || !isValidForm || income <= 0) {
      return;
    }

    calculateIncomeTax(income);
    // Keyed on the total alone. Including `calculateIncomeTax` would re-run this whenever any of
    // its own dependencies changed — including the deduction toggle, whose existing behaviour is
    // to clear the results rather than silently re-tax — and `income` would fight the setter that
    // changes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [additionalIncomeTotal]);

  const onCalculate = () => {
    if (isValidForm) {
      calculateIncomeTax(income);
    }
  };

  /**
   * Sets the standard deduction explicitly, rather than only by toggling.
   *
   * A saved scenario records whether the deduction was applied, and applying one has to put the
   * checkbox where it was rather than leave it wherever the user last left it — a scenario whose
   * deduction cannot be restored would not be the scenario the user saved.
   */
  const setStandardDeduction = useCallback((apply: boolean) => {
    setUseStandardDeduction(apply);
    // The figures on screen were worked out under the old setting, so they are stale the moment
    // this changes. Cleared rather than recalculated, because recalculating here would fight the
    // caller mid-way through applying a scenario.
    setResultsReady(false);
  }, []);

  /**
   * Sets the income from a number rather than from the text box.
   *
   * The scenario arrives as integer paise and has to land in the same whole-rupee figure the text
   * box holds, so the conversion and the cap live here rather than at each call site. Mirrors
   * `onIncomeChange`, including the recalculation on a desktop, so a restored scenario looks
   * exactly like a typed one.
   */
  const setIncomeValue = useCallback(
    (value: number) => {
      setResultsReady(false);
      const applicableIncome = Math.min(Math.max(value, 0), MAX_INCOME);
      setIsValidForm(true);
      setIncome(applicableIncome);

      if (!isMobile) {
        calculateIncomeTax(applicableIncome);
      }
    },
    [calculateIncomeTax, isMobile]
  );

  const getTaxCalculationSummary = () => ({
    marginalRelief,
    rebate: applicableRebate,
    totalIncomeTax,
    incomeAfterDeductions,
    applicableTaxSlabs,
    otherTaxes,
    standardDeduction: useStandardDeduction ? standardDeduction.amount : 0,
  });

  return {
    resultsReady,
    income,
    isValidForm,
    isStandardDeductionApplied: useStandardDeduction,
    toggleStdDeduction,
    setStandardDeduction,
    setIncomeValue,
    onCalculate,
    onIncomeChange,
    getTaxCalculationSummary,
  };
};
