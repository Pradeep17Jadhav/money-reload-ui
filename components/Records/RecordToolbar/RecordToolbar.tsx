import { useCallback, useId, useState } from "react";
import { Checkbox, MenuItem, Popover, Select, TextField } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import FilterListIcon from "@mui/icons-material/FilterList";
import type { SelectOption } from "@/constants/records";
import { SEARCH_MAX_LENGTH } from "@/constants/records";
import type { ListQuery } from "@/types/FinanceTypes";

import styles from "./RecordToolbar.module.css";

export type MultiFilter = {
  /** Key on `ListQuery`, sent as a repeated query parameter. */
  key: string;
  label: string;
  options: SelectOption[];
};

export type SortFilter = {
  label: string;
  options: SelectOption[];
};

type Props = {
  query: ListQuery;
  sortOptions: SelectOption[];
  filters: MultiFilter[];
  hasActiveFilters: boolean;
  onChange: (updater: (current: ListQuery) => ListQuery) => void;
  onReset: () => void;
  onAdd: () => void;
  addLabel: string;
  /**
   * A second action beside the primary one, for screens with a second way in.
   *
   * Rendered as a secondary button rather than a second primary: two equally-weighted
   * primary actions on a toolbar make it ambiguous which one the user is meant to press.
   * Omitted entirely for a resource that has no second way in.
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
};

/**
 * One action for the screen, and a popover holding every control that changes what the list is.
 *
 * **Everything that narrows or reorders the list is behind the filter button**, search and date
 * range and sort included. What is left on the toolbar is only the thing the toolbar is
 * actually for — the way to add something — so the row reads as one action rather than as a
 * control panel that happens to have a button at the end of it.
 *
 * Changing any control still returns to page one.
 */
const RecordToolbar = ({
  query,
  sortOptions,
  filters,
  hasActiveFilters,
  onChange,
  onReset,
  onAdd,
  addLabel,
  secondaryAction,
}: Props) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPanelId = useId();

  /**
   * How many of those controls are currently narrowing the list.
   *
   * Not a nicety. With them all hidden behind a closed popover, this count and the button's
   * filled state are the only things telling the user that what they are looking at is a subset
   * rather than everything they have. Sort is deliberately excluded: reordering a list does not
   * change how much of it there is, and counting it would claim the list is narrowed when it is
   * not.
   */
  const activeFilterCount =
    (query.search ? 1 : 0) +
    (query.from || query.to ? 1 : 0) +
    filters.filter((filter) => {
      const value = query[filter.key as keyof ListQuery];

      return Array.isArray(value) && value.length > 0;
    }).length;

  const handleSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const search = event.target.value;
      onChange((current) => ({ ...current, search: search || undefined }));
    },
    [onChange]
  );

  const handleDate = useCallback(
    (key: "from" | "to") => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      onChange((current) => ({ ...current, [key]: value || undefined }));
    },
    [onChange]
  );

  const handleSort = useCallback(
    (event: SelectChangeEvent<string>) => {
      const sort = event.target.value;
      onChange((current) => ({ ...current, sort: sort || undefined }));
    },
    [onChange]
  );

  const handleMulti = useCallback(
    (key: string) => (event: SelectChangeEvent<string | string[]>) => {
      const raw = event.target.value;
      const selected = Array.isArray(raw) ? raw : raw.split(",");
      // Repeatable filters are sent as repeated keys; an empty selection is omitted entirely
      // rather than sent as an empty value.
      onChange((current) => ({ ...current, [key]: selected.length ? selected : undefined }));
    },
    [onChange]
  );

  const selectedLabels = (filter: MultiFilter): string[] => {
    const value = query[filter.key as keyof ListQuery];
    const chosen = Array.isArray(value) ? value : [];

    return chosen.map(
      (entry) => filter.options.find((option) => option.value === entry)?.label ?? entry
    );
  };

  const popoverSx = {
    marginTop: 1,
    width: 320,
    padding: 2,
    display: "flex",
    flexDirection: "column",
    gap: 1.5,
  } as const;

  return (
    <div className={styles.toolbar} data-testid="records-toolbar">
      {/*
       * At the extreme left, as the way into everything that shapes the list.
       *
       * Hidden entirely on a resource with no controls at all, rather than opening an empty
       * panel — a search box alone still counts as something to put behind it.
       */}
      <button
        type="button"
        className={
          activeFilterCount > 0 ? styles.filterButtonActive : styles.filterButton
        }
        onClick={() => setIsFilterOpen((open) => !open)}
        aria-expanded={isFilterOpen}
        aria-controls={filterPanelId}
        aria-label={
          activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"
        }
        data-testid="records-filter-toggle"
      >
        <FilterListIcon fontSize="small" />
        {activeFilterCount > 0 && (
          <span className={styles.filterCount} data-testid="records-filter-count">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/*
       * Anchored to the button's bottom-right corner and opening from its own top-left, so the
       * panel sits below and just to the right of the button rather than over the screen edge.
       */}
      <Popover
        id={filterPanelId}
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: popoverSx } }}
      >
        <div className={styles.popoverHeader}>
          <span className={styles.popoverTitle}>
            {activeFilterCount > 0
              ? `${activeFilterCount} narrowing the list`
              : "Showing everything"}
          </span>
        </div>

        <div className={styles.popoverBody}>
          {/*
           * A plain label, like the ones the toolbar used to carry. MUI's `InputLabel` brings
           * its own font-size and transform, which is why these read differently from the rest
           * of the app.
           */}
          <div className={styles.popoverControl}>
            <label className={styles.label} htmlFor="filter-search">
              Search
            </label>
            <TextField
              id="filter-search"
              size="small"
              fullWidth
              placeholder="Search records"
              value={query.search ?? ""}
              onChange={handleSearch}
              slotProps={{ htmlInput: { maxLength: SEARCH_MAX_LENGTH } }}
            />
          </div>

          <div className={styles.popoverDates}>
            <div className={styles.popoverControl}>
              <label className={styles.label} htmlFor="filter-from">
                From
              </label>
              <TextField
                id="filter-from"
                size="small"
                fullWidth
                type="date"
                value={query.from ?? ""}
                onChange={handleDate("from")}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </div>

            <div className={styles.popoverControl}>
              <label className={styles.label} htmlFor="filter-to">
                To
              </label>
              <TextField
                id="filter-to"
                size="small"
                fullWidth
                type="date"
                value={query.to ?? ""}
                onChange={handleDate("to")}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </div>
          </div>

          <div className={styles.popoverControl}>
            <label className={styles.label} htmlFor="filter-sort">
              Sort by
            </label>
            <Select
              id="filter-sort"
              size="small"
              displayEmpty
              value={query.sort ?? ""}
              onChange={handleSort}
            >
              <MenuItem value="">Default</MenuItem>
              {sortOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </div>

          {filters.map((filter) => (
            <div className={styles.popoverControl} key={filter.key}>
              <label className={styles.label} htmlFor={`filter-${filter.key}`}>
                {filter.label}
              </label>
              <Select
                id={`filter-${filter.key}`}
                size="small"
                multiple
                value={(query[filter.key as keyof ListQuery] as string[] | undefined) ?? []}
                onChange={handleMulti(filter.key)}
                renderValue={() => selectedLabels(filter).join(", ")}
                MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
              >
                {filter.options.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Checkbox size="small" checked />
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </div>
          ))}
        </div>

        {/*
         * At the bottom, on a divider, where a reset belongs once everything above it is
         * scrolled past. Left on the toolbar it would have been the only thing there, which is
         * a poor advertisement for a control that is usually not needed.
         */}
        <div className={styles.popoverFooter}>
          <button
            type="button"
            className={styles.popoverClear}
            onClick={onReset}
            disabled={!hasActiveFilters}
            data-testid="records-clear-filters"
          >
            Clear filters
          </button>
        </div>
      </Popover>

      <div className={styles.spacer} />

      <div className={styles.actions}>
        {secondaryAction && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={secondaryAction.onClick}
            data-testid="records-secondary-action"
          >
            {secondaryAction.label}
          </button>
        )}
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onAdd}
          data-testid="records-add"
        >
          <AddIcon fontSize="small" />
          {addLabel}
        </button>
      </div>
    </div>
  );
};

export default RecordToolbar;