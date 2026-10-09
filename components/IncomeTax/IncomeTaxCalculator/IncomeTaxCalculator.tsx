"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SelectChangeEvent } from "@mui/material";
import { useIncomeTax } from "@/hooks/IncomeTax/useIncomeTax";
import { useSavedIncomeTaxCalculationsProvider } from "@/contexts/incomeTax/savedCalculationsContext";
import { useAuth } from "@/contexts/authContext";
import { getAuthErrorCopy } from "@/helpers/apiErrors";
import { createIncomeTaxCalculation } from "@/services/incomeTax/calculations";
import { toDisplayRegime, toStoredRegime } from "@/types/IncomeTax/CalculationTypes";
import type { AdditionalIncomeEntry } from "@/types/IncomeTax/CalculationTypes";
import { PAISE_PER_RUPEE } from "@/helpers/money";
import { IncomeTaxConfig } from "@/types/ConfigTypes";
import IncomeTaxSummary from "../IncomeTaxSummary/IncomeTaxSummary";
import IncomeTaxInput from "../IncomeTaxInput/IncomeTaxInput";
import AdditionalIncomeSection from "../AdditionalIncomeSection/AdditionalIncomeSection";
import TwoColumnContainer from "../../Common/TwoColumnContainer/TwoColumnContainer";
import SavedIncomeTaxCalculationsSelect from "../SavedIncomeTaxCalculationsSelect/SavedIncomeTaxCalculationsSelect";
import SaveCalculationDialog from "../../Loan/SaveCalculationDialog/SaveCalculationDialog";
import type { SaveCalculationValues } from "../../Loan/SaveCalculationDialog/SaveCalculationDialog";

import styles from "./IncomeTaxCalculator.module.css";

type Props = {
  incomeTaxConfig: IncomeTaxConfig;
};

const IncomeTaxCalculator = ({ incomeTaxConfig }: Props) => {
  const { isSignedIn, authorisedRequest } = useAuth();
  const { budgets } = incomeTaxConfig;
  const [budgetIndex, setBudgetIndex] = useState(0);
  const taxLiabilityRef = useRef<HTMLDivElement>(null);

  /*
   * The side incomes, held here rather than inside the calculator or the section.
   *
   * The list is a fact about the taxpayer rather than an input to the tax formula, and three
   * things need it: the summary, the save request, and restoring a saved scenario. Owning it here
   * is what lets a scenario be saved and restored as the single unit it is — the salary and these
   * lines together — rather than as a salary with some orphans beside it.
   */
  const [additionalIncome, setAdditionalIncome] = useState<AdditionalIncomeEntry[]>([]);
  const additionalIncomeTotal = useMemo(
    () => additionalIncome.reduce((sum, entry) => sum + entry.amount, 0),
    [additionalIncome]
  );

  const {
    income,
    isValidForm,
    resultsReady,
    toggleStdDeduction,
    setStandardDeduction,
    setIncomeValue,
    getTaxCalculationSummary,
    onCalculate,
    onIncomeChange,
  } = useIncomeTax(budgets[budgetIndex], additionalIncomeTotal / PAISE_PER_RUPEE);
  const { standardDeduction } = getTaxCalculationSummary();

  /*
   * One read of the saved scenarios, shared with the dropdown below it, so a scenario picked up
   * there arrives here and one saved a moment ago is in the dropdown without a second fetch.
   */
  const {
    pendingCalculation,
    clearPendingCalculation,
    refetch: refetchCalculations,
  } = useSavedIncomeTaxCalculationsProvider();

  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const onBudgetSelectionChange = useCallback((event: SelectChangeEvent) => {
    setBudgetIndex(parseInt(event.target.value));
  }, []);

  const handleIncomeChange = useCallback(
    (
      e?: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      income?: string
    ) => {
      const newIncome = e?.target.value || income || "0";
      onIncomeChange(newIncome);
    },
    [onIncomeChange]
  );

  const handleCalculateBtnClick = useCallback(() => {
    onCalculate();
    taxLiabilityRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [onCalculate]);

  /*
   * Restores a saved scenario into the calculator.
   *
   * The budget is matched on **both** the year and the regime, because the regime dropdown is
   * derived from whichever budget is selected rather than chosen on its own: picking a scenario
   * recorded against the old regime must select the old-regime budget, or the slabs would be the
   * new ones and the scenario would quietly mean something else.
   *
   * A scenario whose year is no longer in the site's config cannot be applied at all, and saying
   * so is better than falling back to the first budget — which would quote a year the user never
   * saved against.
   */
  useEffect(() => {
    if (!pendingCalculation) {
      return;
    }

    const scenario = pendingCalculation;
    const matchIndex = budgets.findIndex(
      (budget) =>
        budget.assessmentYear === scenario.assessmentYear &&
        budget.regime === toDisplayRegime(scenario.regime)
    );

    if (matchIndex < 0) {
      setSaveBanner(
        `That calculation is for AY ${scenario.assessmentYear}, which is no longer in this calculator's list of years.`
      );
      clearPendingCalculation();
      return;
    }

    setBudgetIndex(matchIndex);
    setStandardDeduction(scenario.useStandardDeduction);
    // Stored in paise, shown in whole rupees, which is what the input holds.
    setIncomeValue(scenario.annualIncome / PAISE_PER_RUPEE);
    // The side incomes are part of the same unit, so they are restored with it. Leaving them
    // behind would apply a saved scenario's salary to whatever the user happened to have typed
    // into the section, and the tax would then match neither.
    setAdditionalIncome(scenario.additionalIncome ?? []);
    clearPendingCalculation();
  }, [
    budgets,
    clearPendingCalculation,
    pendingCalculation,
    setIncomeValue,
    setStandardDeduction,
  ]);

  /**
   * Saves the calculator exactly as it stands.
   *
   * A snapshot, and nothing about it is editable afterwards: saving a figure the user has not
   * seen is not a scenario they could recognise later. The regime is read from the selected
   * budget rather than asked for, because the calculator's own dropdown already decides it.
   */
  const handleSave = useCallback(
    async (values: SaveCalculationValues) => {
      setIsSaving(true);
      setSaveBanner(null);
      setSaveErrors({});

      const budget = budgets[budgetIndex];

      try {
        await createIncomeTaxCalculation(authorisedRequest, {
          name: values.name,
          description: values.description.length > 0 ? values.description : null,
          assessmentYear: budget.assessmentYear,
          financialYear: budget.financialYear,
          regime: toStoredRegime(budget.regime),
          annualIncome: Math.round(income * PAISE_PER_RUPEE),
          useStandardDeduction: standardDeduction > 0,
          // Part of the same record as the salary it is taxed on top of, and omitted entirely
          // when there is none rather than sent as an empty list.
          ...(additionalIncome.length > 0 ? { additionalIncome } : {}),
        });

        setIsSaveOpen(false);
        // The dropdown reads the same list, so it has to be re-read for the new scenario to be
        // pickable straight away.
        refetchCalculations();
      } catch (thrown) {
        const copy = getAuthErrorCopy(thrown);
        setSaveBanner(copy.banner);
        setSaveErrors(copy.fields);
      } finally {
        setIsSaving(false);
      }
    },
    [
      additionalIncome,
      authorisedRequest,
      budgetIndex,
      budgets,
      income,
      refetchCalculations,
      standardDeduction,
    ]
  );

  const incomeTaxInput = useMemo(
    () => (
      <IncomeTaxInput
        handleIncomeChange={handleIncomeChange}
        onBudgetSelectionChange={onBudgetSelectionChange}
        toggleStdDeduction={toggleStdDeduction}
        onCalculate={handleCalculateBtnClick}
        budgets={budgets}
        standardDeduction={standardDeduction}
        income={income}
        budgetIndex={budgetIndex}
        isValidForm={isValidForm}
        onSave={isSignedIn ? () => setIsSaveOpen(true) : undefined}
        isSaveDisabled={!isSignedIn || !isValidForm}
      />
    ),
    [
      budgetIndex,
      budgets,
      handleCalculateBtnClick,
      handleIncomeChange,
      income,
      isSignedIn,
      isValidForm,
      standardDeduction,
      toggleStdDeduction,
    ]
  );

  const incomeTaxSummary = useMemo(
    () => (
      <IncomeTaxSummary
        income={income}
        additionalIncomeTotal={additionalIncomeTotal}
        resultsReady={resultsReady}
        budget={budgets[budgetIndex]}
        getTaxCalculationSummary={getTaxCalculationSummary}
        taxLiabilityRef={taxLiabilityRef}
      />
    ),
    [
      additionalIncomeTotal,
      budgetIndex,
      budgets,
      getTaxCalculationSummary,
      income,
      resultsReady,
    ]
  );

  return (
    <>
      {/* Above the calculator and centred, so it reads as a control for the whole thing rather
          than as one more input in the left column. */}
      <div className={styles.savedCalculations}>
        <SavedIncomeTaxCalculationsSelect />
      </div>

      <TwoColumnContainer
        leftColumn={incomeTaxInput}
        rightColumn={incomeTaxSummary}
      ></TwoColumnContainer>

      {/*
        * Below the calculator, because these lines are added to a year already entered rather than
        * being part of entering it — and because the summary above has to be re-read against the
        * new total, which is why the list is lifted rather than owned by the section.
       */}
      <AdditionalIncomeSection
        entries={additionalIncome}
        onChange={(entry, index) => {
          // No recalculation here: the tax hook re-derives when the total changes, so a line
          // added or corrected anywhere — including by restoring a scenario — cannot leave a
          // stale summary.
          setAdditionalIncome((current) =>
            index === null
              ? [...current, entry]
              : current.map((existing, i) => (i === index ? entry : existing))
          );
        }}
        onRemove={(index) => {
          setAdditionalIncome((current) => current.filter((_, i) => i !== index));
        }}
      />

      {/*
        * Behind a session, like the dropdown above it. `isSignedIn` gates the button as well as
        * the dialog, so an anonymous visitor is never shown a control that would only produce a
        * 401 — the whole feature is absent rather than broken.
       */}
      {isSignedIn && (
        <SaveCalculationDialog
          open={isSaveOpen}
          isSaving={isSaving}
          banner={saveBanner}
          errors={saveErrors}
          onClose={() => setIsSaveOpen(false)}
          onSubmit={handleSave}
        />
      )}
    </>
  );
};

export default IncomeTaxCalculator;