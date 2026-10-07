import classnames from "classnames";

import styles from "./SummaryTiles.module.css";

export type SummaryTile = {
  label: string;
  value: string;
  /** Secondary line, such as a record count. */
  subValue?: string;
};

type Props = {
  tiles: SummaryTile[];
  isLoading: boolean;
  error: string | null;
};

/**
 * Totals from a `/summary` endpoint. Rendered as soon as the data lands, and
 * left empty rather than showing zero while loading, so a tile is never briefly
 * a lie.
 */
const SummaryTiles = ({ tiles, isLoading, error }: Props) => {
  if (error) {
    return (
      <div
        className={classnames(styles.tile, styles.errorTile)}
        role="alert"
        data-testid="summary-error"
      >
        {error}
      </div>
    );
  }

  if (isLoading) {
    return null;
  }

  if (tiles.length === 0) {
    return null;
  }

  return (
    <div className={styles.grid} data-testid="summary-tiles">
      {tiles.map((tile) => (
        <div
          className={styles.tile}
          key={tile.label}
          data-testid={`summary-tile-${tile.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        >
          <span className={styles.label}>{tile.label}</span>
          <span className={styles.value}>{tile.value}</span>
          {tile.subValue ? <span className={styles.subValue}>{tile.subValue}</span> : null}
        </div>
      ))}
    </div>
  );
};

export default SummaryTiles;