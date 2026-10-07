import { useCallback } from "react";
import { Checkbox, MenuItem, Select, TextField } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
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
};

/**
 * Search, date range, sort and the repeatable filters, plus the single primary
 * action for the screen. Changing any control returns to page one.
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
}: Props) => {
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
      // Repeatable filters are sent as repeated keys; an empty selection is
      // omitted entirely rather than sent as an empty value.
      onChange((current) => ({ ...current, [key]: selected.length ? selected : undefined }));
    },
    [onChange]
  );

  return (
    <div className={styles.toolbar} data-testid="records-toolbar">
      <div className={styles.controlWide}>
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

      <div className={styles.controlNarrow}>
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

      <div className={styles.controlNarrow}>
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

      <div className={styles.control}>
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
        <div className={styles.control} key={filter.key}>
          {/*
           * A plain label, like the search and date labels above. MUI's
           * `InputLabel` brings its own font-size and transform, which is why
           * these two read differently from every other label on the toolbar.
           */}
          <label className={styles.label} htmlFor={`filter-${filter.key}`}>
            {filter.label}
          </label>
          <Select
            id={`filter-${filter.key}`}
            className={styles.multiSelect}
            size="small"
            multiple
            value={(query[filter.key as keyof ListQuery] as string[] | undefined) ?? []}
            onChange={handleMulti(filter.key)}
            renderValue={(selected) =>
              (selected as string[]).map((value) =>
                filter.options.find((option) => option.value === value)?.label ?? value
              )
            }
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

      <div className={styles.spacer} />

      <div className={styles.actions}>
        {hasActiveFilters && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onReset}
            data-testid="records-clear-filters"
          >
            Clear filters
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