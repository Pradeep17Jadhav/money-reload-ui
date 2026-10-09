import {
  calculateOtherTaxes,
  getTotalTaxFromOtherTaxes,
} from "@/components/IncomeTax/helpers";
import { splitTaxAcrossSlabs } from "@/components/IncomeTax/helpers/slabSplit";
import { PAISE_PER_RUPEE } from "@/helpers/money";
import type { Budget, CalculatedTaxSlab, TaxSlab } from "@/types/ConfigTypes";
import type { SavedIncomeTaxCalculation } from "@/types/IncomeTax/CalculationTypes";
import { toDisplayRegime } from "@/types/IncomeTax/CalculationTypes";

/**
 * What a saved scenario is worth, worked out from what it stores.
 *
 * The same shape of answer the calculator itself reaches, and deliberately produced by the same
 * helpers: an imported income shows this figure, and the calculator showed that one, so a user
 * comparing them must not find two different numbers for the same inputs.
 */
export type IncomeTaxScenarioProjection = {
  /** Integer paise, the annual income the scenario was saved with. */
  annualIncome: number;
  /** Integer paise. Everything the additional-income lines come to, taxed on top. */
  additionalIncomeTotal: number;
  /** Integer paise. What the tax comes to for that year, both incomes together. */
  tax: number;
  /** `YYYY`, e.g. `2026`. */
  assessmentYear: string;
  /** `YYYY-YY`, e.g. `2025-26`. */
  financialYear: string;
};

/**
 * The tax a scenario works out to, or `null` when the budget behind it is not in the config.
 *
 * **`null` rather than a zero.** The budgets are site config rather than data, so a scenario
 * saved against a year that has since been dropped cannot be valued at all — and an imported
 * income whose tax reads as zero would be a claim that nothing was withheld, which is a different
 * and wrong answer from "this cannot be worked out".
 *
 * Every figure is in whole currency units internally, because that is what the helpers and the
 * tax slabs themselves are written in; the conversion to paise happens once, on the way out.
 */
export const projectIncomeTaxScenario = (
  scenario: SavedIncomeTaxCalculation,
  budgets: Budget[]
): IncomeTaxScenarioProjection | null => {
  const budget = budgets.find(
    (entry) =>
      entry.assessmentYear === scenario.assessmentYear &&
      entry.regime === toDisplayRegime(scenario.regime)
  );

  if (!budget) {
    return null;
  }

  const { standardDeduction, slabs, rebate, taxes, applyMarginalRelief } = budget;

  // The scenario stores paise; the helpers work in whole currency units.
  const income = scenario.annualIncome / PAISE_PER_RUPEE;
  const additionalIncomeTotal =
    (scenario.additionalIncome ?? []).reduce(
      (total, entry) => total + entry.amount,
      0
    ) / PAISE_PER_RUPEE;
  const deduction = scenario.useStandardDeduction ? standardDeduction.amount : 0;
  const incomeAfterDeductions = income - deduction;

  /*
   * The salary takes the lower slabs first and the additional income only reaches what is left,
   * so the two are charged against the bands in one walk rather than taxed separately and added.
   */
  const { mainTax, additionalTax } = splitTaxAcrossSlabs(
    slabs,
    incomeAfterDeductions,
    additionalIncomeTotal
  );
  const slabTax = mainTax + additionalTax;

  /*
   * The rebate is measured against everything taxable, and marginal relief against the income
   * over the rebate ceiling — so both see the two incomes as the one figure they are.
   */
  const taxableIncome = incomeAfterDeductions + additionalIncomeTotal;

  let applicableRebate = 0;
  let marginalRelief = 0;

  if (taxableIncome <= rebate.amount) {
    applicableRebate = slabTax;
  } else if (applyMarginalRelief) {
    const incomeOverRebate = taxableIncome - rebate.amount;

    if (slabTax > incomeOverRebate) {
      marginalRelief = slabTax - incomeOverRebate;
    }
  }

  const taxBeforeOtherTaxes = slabTax - applicableRebate - marginalRelief;
  const otherTaxes = calculateOtherTaxes(taxBeforeOtherTaxes, taxes);
  const otherTaxesSum = getTotalTaxFromOtherTaxes(otherTaxes);
  const tax = taxBeforeOtherTaxes + otherTaxesSum;

  return {
    annualIncome: scenario.annualIncome,
    additionalIncomeTotal: Math.round(additionalIncomeTotal * PAISE_PER_RUPEE),
    tax: Math.round(Math.max(tax, 0) * PAISE_PER_RUPEE),
    assessmentYear: scenario.assessmentYear,
    financialYear: scenario.financialYear,
  };
};