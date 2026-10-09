"use client";

import IncomeTaxCalculator from "@/components/IncomeTax/IncomeTaxCalculator/IncomeTaxCalculator";
import { SavedIncomeTaxCalculationsProvider } from "@/contexts/incomeTax/savedCalculationsContext";
import type { IncomeTaxConfig } from "@/types/ConfigTypes";

/**
 * The saved-calculations dropdown and the calculator it drives, on one client boundary.
 *
 * They have to be in the same React tree to share the saved-scenarios context, and only the
 * calculator is interactive — so this wrapper is what the page renders. The provider sits here
 * rather than inside the calculator because a component cannot consume a context it provides
 * itself: the dropdown and the calculator are siblings, and something *above* both has to own the
 * one read they share.
 *
 * Read here as well, so the subtree is definitely mounted for both ends before either asks for it.
 */
const IncomeTaxCalculatorWithSavedCalculations = ({
  incomeTaxConfig,
}: {
  incomeTaxConfig: IncomeTaxConfig;
}) => (
  <SavedIncomeTaxCalculationsProvider>
    <IncomeTaxCalculator incomeTaxConfig={incomeTaxConfig} />
  </SavedIncomeTaxCalculationsProvider>
);

export default IncomeTaxCalculatorWithSavedCalculations;