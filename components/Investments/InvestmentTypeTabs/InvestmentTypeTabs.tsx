"use client";

import { labelForEnumValue } from "@/constants/investments";
import type { InvestmentType } from "@/types/FinanceTypes";

import styles from "./InvestmentTypeTabs.module.css";

type Props = {
  /** The types the user actually holds, so no empty tab is ever offered. */
  typesPresent: InvestmentType[];
  /** `null` is the "everything" table. */
  selected: InvestmentType | null;
  onSelect: (type: InvestmentType | null) => void;
};

/**
 * One table per kind of holding.
 *
 * **A tab per type the user actually owns**, rather than a seventeen-way menu of which two are
 * used. The point of splitting the tables is that each kind's figures differ; offering a tab for
 * a kind nobody holds would put the breadth of the vocabulary on screen as though it were a
 * summary of what the user has — the opposite of what it means.
 *
 * "Everything" appears only once there is more than one kind, because with a single kind it
 * would be that kind's table under a vaguer name.
 */
const InvestmentTypeTabs = ({ typesPresent, selected, onSelect }: Props) => {
  if (typesPresent.length === 0) {
    return null;
  }

  const showEverything = typesPresent.length > 1;

  return (
    <div className={styles.tabs} role="tablist" aria-label="Kind of holding">
      {showEverything && (
        <button
          type="button"
          role="tab"
          aria-selected={selected === null}
          className={selected === null ? styles.tabActive : styles.tab}
          onClick={() => onSelect(null)}
          data-testid="investment-tab-all"
        >
          Everything
        </button>
      )}

      {typesPresent.map((type) => (
        <button
          key={type}
          type="button"
          role="tab"
          aria-selected={selected === type}
          className={selected === type ? styles.tabActive : styles.tab}
          onClick={() => onSelect(type)}
          data-testid={`investment-tab-${type}`}
        >
          {labelForEnumValue(type)}
        </button>
      ))}
    </div>
  );
};

export default InvestmentTypeTabs;