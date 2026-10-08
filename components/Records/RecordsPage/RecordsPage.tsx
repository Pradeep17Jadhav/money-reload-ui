import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import Pagination from "@mui/material/Pagination";
import RequireAuth from "@/components/RequireAuth/RequireAuth";
import RecordTable from "@/components/Records/RecordTable/RecordTable";
import type { TableColumn } from "@/components/Records/RecordTable/RecordTable";
import RecordToolbar from "@/components/Records/RecordToolbar/RecordToolbar";
import type { MultiFilter } from "@/components/Records/RecordToolbar/RecordToolbar";
import RecordDialog from "@/components/Records/RecordDialog/RecordDialog";
import SummaryTiles from "@/components/Records/SummaryTiles/SummaryTiles";
import type { SummaryTile } from "@/components/Records/SummaryTiles/SummaryTiles";
import { FieldGroup } from "@/components/Records/Field/Field";
import type { RecordsScreen } from "@/hooks/Finance/useRecordsScreen";
import type { RecordCollection } from "@/hooks/Finance/useRecordCollection";
import type { SelectOption } from "@/constants/records";

import styles from "./RecordsPage.module.css";

export type RecordsPageProps<TItem> = {
  title: string;
  subtitle: string;
  addLabel: string;
  /**
   * A second way in, for a screen that has one. Rendered beside the primary action and
   * omitted when absent, so a resource that only offers "add" is left unchanged.
   */
  secondaryAction?: { label: string; onClick: () => void };
  /**
   * Takes over editing one row, instead of the generic dialog.
   *
   * For a record whose fields are not its own — a loan instalment expense carries no amount,
   * because the loan's amortisation owns that. The generic form would offer the field and then
   * have the API refuse it, so the screen is given a say in how a row is edited.
   *
   * Returns `true` if the row was claimed. Anything else falls through to the usual dialog, so
   * a screen can claim only the rows that need it and leave the rest alone.
   */
  onRowEdit?: (item: TItem) => boolean;
  /**
   * Rendered between the toolbar and the table.
   *
   * For a screen's own control over what the table contains — `/investments` switching between
   * one kind of holding and another. Omitted for every other resource, so nothing moves.
   */
  tableHeader?: React.ReactNode;
  submitLabel: string;
  editSubmitLabel: string;
  emptyMessage: string;
  /** Used in the table caption and the row action labels. */
  caption: string;
  deleteMessage: string;
  columns: TableColumn<TItem>[];
  sortOptions: SelectOption[];
  filters: MultiFilter[];
  summaryTiles: SummaryTile[];
  summaryError: string | null;
  isSummaryLoading: boolean;
  collection: RecordCollection<TItem>;
  screen: RecordsScreen<TItem>;
};

/**
 * The shared shape of all four record routes: a guard, a heading, the summary
 * totals, the toolbar, the table and the create/edit dialog.
 *
 * Everything resource-specific arrives as props, so adding a route is a config
 * object rather than a new screen.
 */
const RecordsPage = <TItem,>({
  title,
  subtitle,
  addLabel,
  secondaryAction,
  onRowEdit,
  tableHeader,
  submitLabel,
  editSubmitLabel,
  emptyMessage,
  caption,
  deleteMessage,
  columns,
  sortOptions,
  filters,
  summaryTiles,
  summaryError,
  isSummaryLoading,
  collection,
  screen,
}: RecordsPageProps<TItem>) => {
  const { query, meta, isLoading, error, items } = collection;
  const {
    mode,
    values,
    visibleFields,
    errors,
    banner,
    isSubmitting,
    isDialogOpen,
    isDeleteOpen,
  } = screen;

  const hasActiveFilters = Boolean(
    query.search || query.from || query.to || filters.some((filter) => query[filter.key as keyof typeof query])
  );

  return (
    <RequireAuth>
      <main className={styles.container}>
        <h1 className={styles.pageTitle}>{title}</h1>
        <h2 className={styles.pageSubtitle}>{subtitle}</h2>

        <div className={styles.surface} data-testid="records-surface">
          <SummaryTiles
            tiles={summaryTiles}
            isLoading={isSummaryLoading}
            error={summaryError}
          />

          <div className={styles.divider} />

          <RecordToolbar
            query={query}
            sortOptions={sortOptions}
            filters={filters}
            hasActiveFilters={hasActiveFilters}
            onChange={collection.updateQuery}
            onReset={collection.resetFilters}
            onAdd={screen.openCreate}
            addLabel={addLabel}
            secondaryAction={secondaryAction}
          />

          <div className={styles.divider} />

          {/*
           * Between the toolbar and the table, because that is where a control over *what the
           * table is showing* belongs. Above the heading it would read as part of the page's
           * furniture; inside the toolbar it would sit among filters that do something
           * different — narrowing by search or sort leaves the list alone, whereas these tabs
           * decide what is in it at all.
           */}
          {tableHeader}

          {error && (
            <p className={styles.listBanner} role="alert" data-testid="records-error">
              {error}
            </p>
          )}

          {isLoading ? (
            <div className={styles.loading} role="status" aria-live="polite" data-testid="records-loading">
              <CircularProgress size={28} aria-label={`Loading ${caption}`} />
              <span>Loading records</span>
            </div>
          ) : (
            <div data-testid="records-table-region">
              <RecordTable
                columns={columns}
                items={items}
                getId={screen.getId}
                onEdit={
                  // A row the screen claims for itself; every other row falls through to the
                  // generic dialog. Returning `false` is how a screen says "not this one".
                  onRowEdit
                    ? (item: TItem) => {
                        if (!onRowEdit(item)) {
                          screen.openEdit(item);
                        }
                      }
                    : screen.openEdit
                }
                onDelete={screen.askDelete}
                emptyMessage={emptyMessage}
                caption={caption}
              />

              {meta && meta.totalPages > 1 && (
                <div className={styles.footer}>
                  <span data-testid="records-total">
                    {meta.total} record{meta.total === 1 ? "" : "s"}
                  </span>
                  <Pagination
                    count={meta.totalPages}
                    page={query.page ?? 1}
                    onChange={(_event, page) => collection.setPage(page)}
                    color="primary"
                    size="small"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <RecordDialog
        open={isDialogOpen}
        title={mode === "edit" ? `Edit ${caption}` : addLabel}
        banner={banner}
        isSubmitting={isSubmitting}
        submitLabel={mode === "edit" ? editSubmitLabel : submitLabel}
        onClose={screen.close}
        onSubmit={() => {
          void screen.submit();
        }}
      >
        <form
          id="record-form"
          onSubmit={(event) => {
            event.preventDefault();
            void screen.submit();
          }}
        >
          <FieldGroup
            fields={visibleFields}
            values={values}
            errors={errors}
            onChange={screen.handleChange}
            onBlur={screen.handleBlur}
          />
        </form>
      </RecordDialog>

      <Dialog
        open={isDeleteOpen}
        onClose={screen.closeDelete}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete {caption}</DialogTitle>
        <DialogContent data-testid="delete-confirm-body">{deleteMessage}</DialogContent>
        <DialogActions className={styles.confirmActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={screen.closeDelete}
            data-testid="delete-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              void screen.confirmDelete();
            }}
            data-testid="delete-confirm"
          >
            Delete
          </button>
        </DialogActions>
      </Dialog>
    </RequireAuth>
  );
};

export default RecordsPage;