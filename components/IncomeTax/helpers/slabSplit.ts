import type { CalculatedTaxSlab, TaxSlab } from "@/types/ConfigTypes";

/**
 * How the slabs were shared between the main income and the additional income.
 *
 * Split out rather than returning a single number because the summary has to show the split, and
 * because a reader checking the arithmetic needs to see which income paid what.
 */
export type SlabSplit = {
  /** Tax on the main income, which takes the lower slabs first. */
  mainTax: number;
  /** Tax on the additional income, which only reaches the slabs the main income left. */
  additionalTax: number;
  /** Per-slab rows for the table, in whole currency units. */
  rows: CalculatedTaxSlab[];
};

/**
 * Tax two incomes against one set of slabs, **in order**.
 *
 * The main income goes first and the additional income takes only what is left — which is both
 * what the brief asks for and how the tax actually works: the lower bands are consumed by salary
 * before a side income gets to them.
 *
 * Walking the bands once, top to bottom, and charging each to whichever income still has income
 * left to tax, is what produces that order. Taxing the two separately and adding the results
 * would quietly disagree: a main income of Rs 6,00,000 and an additional Rs 6,00,000 against
 * 0/5/20% bands come to Rs 60,000 in total either way here, but the split differs, and on a
 * steeper scale the *total* differs too — each taken from the top of the scale would understate
 * the bill.
 *
 * An `incomeTo` of `-1` is the open-ended final band, matching the config's own convention, and
 * absorbs whatever is left however much that is.
 *
 * All figures are whole currency units, because that is what the bands themselves are written in.
 */
export const splitTaxAcrossSlabs = (
  slabs: TaxSlab[],
  mainIncome: number,
  additionalIncome: number
): SlabSplit => {
  let remainingMain = Math.max(mainIncome, 0);
  let remainingAdditional = Math.max(additionalIncome, 0);
  let mainTax = 0;
  let additionalTax = 0;
  const rows: CalculatedTaxSlab[] = [];

  for (const { incomeFrom, incomeTo, taxInPercent } of slabs) {
    if (remainingMain <= 0 && remainingAdditional <= 0) {
      break;
    }

    const bandWidth =
      incomeTo === -1 ? Number.POSITIVE_INFINITY : incomeTo - incomeFrom;

    // The main income is charged first, up to the width of the band...
    const toMain = Math.min(remainingMain, bandWidth);
    // ...and whatever the band still has room for then goes to the additional income.
    const toAdditional = Math.min(
      remainingAdditional,
      Math.max(bandWidth - toMain, 0)
    );

    if (toMain <= 0 && toAdditional <= 0) {
      continue;
    }

    remainingMain -= toMain;
    remainingAdditional -= toAdditional;

    mainTax += (toMain * taxInPercent) / 100;
    additionalTax += (toAdditional * taxInPercent) / 100;

    rows.push({
      incomeFrom,
      // The open-ended band has no upper figure of its own, so it is reported as far as it
      // actually reached — otherwise the summary would show a band ending nowhere.
      incomeTo:
        incomeTo === -1 ? incomeFrom + toMain + toAdditional : incomeTo,
      taxInPercent,
      // The band's tax as a whole, which is what the summary has always shown.
      applicableTax: ((toMain + toAdditional) * taxInPercent) / 100,
    });
  }

  return { mainTax, additionalTax, rows };
};