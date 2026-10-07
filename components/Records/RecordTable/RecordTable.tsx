import classnames from "classnames";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import styles from "./RecordTable.module.css";

export type Tone = "success" | "warning" | "error" | "neutral";

export type TableColumn<TItem> = {
  key: string;
  header: string;
  /** Right-aligned with tabular figures, for money and other numbers. */
  numeric?: boolean;
  render: (item: TItem) => React.ReactNode;
};

type Props<TItem> = {
  columns: TableColumn<TItem>[];
  items: TItem[];
  getId: (item: TItem) => string;
  onEdit: (item: TItem) => void;
  onDelete: (item: TItem) => void;
  emptyMessage: string;
  caption: string;
};

export const Badge = ({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) => (
  <span className={classnames(styles.badge, styles[`badge${tone.charAt(0).toUpperCase()}${tone.slice(1)}`])}>
    {children}
  </span>
);

/**
 * A cell with a primary line and a quieter second line, so a column can carry
 * a reference or an end date without inventing a new table structure.
 */
export const CellStack = ({
  primary,
  secondary,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) => (
  <div className={styles.stack}>
    <span>{primary}</span>
    {secondary ? <span className={styles.subText}>{secondary}</span> : null}
  </div>
);

export const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className={styles.muted}>{children}</span>
);

/**
 * The shared record table. Columns are supplied by each resource, which keeps
 * loans and expenses rendering through the same markup, spacing and actions.
 */
const RecordTable = <TItem,>({
  columns,
  items,
  getId,
  onEdit,
  onDelete,
  emptyMessage,
  caption,
}: Props<TItem>) => {
  if (items.length === 0) {
    return (
      <p className={styles.muted} role="status" data-testid="records-empty">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table} data-testid="records-table">
        <caption className={styles.muted}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.numeric ? styles.numeric : undefined} scope="col">
                {column.header}
              </th>
            ))}
            <th scope="col" className={styles.numeric}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={getId(item)} data-testid={`records-row-${getId(item)}`}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? styles.numeric : undefined}>
                  {column.render(item)}
                </td>
              ))}
              <td className={styles.numeric}>
                <div className={styles.actions}>
                  <Tooltip title="Edit">
                    <IconButton
                      className={styles.iconButton}
                      size="small"
                      aria-label={`Edit ${caption} row`}
                      onClick={() => onEdit(item)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      className={styles.iconButton}
                      size="small"
                      aria-label={`Delete ${caption} row`}
                      onClick={() => onDelete(item)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecordTable;
export { RecordTable };