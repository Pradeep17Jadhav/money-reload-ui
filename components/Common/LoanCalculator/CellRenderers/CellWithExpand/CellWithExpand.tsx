import { SxProps, TableCell, Theme } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { YEAR_COLUMN_WIDTH } from "../../constants";

import styles from "./CellWithExpand.module.css";

type Props = {
  value: string | number;
  sx?: SxProps<Theme>;
  align?: "center" | "left" | "right" | "inherit" | "justify";
  isExpanded: boolean;
  key: string;
};

/**
 * The year cell, with a chevron showing whether its months are showing.
 *
 * The chevron is a plain indicator rather than a button: the whole row is the
 * control, and nesting a focusable button inside a focusable row would put two
 * stops for one action on the tab order.
 */
const CellWithExpand = ({ value, isExpanded, align }: Props) => {
  return (
    <TableCell
      sx={{
        width: `${YEAR_COLUMN_WIDTH}px`,
        padding: "0",
      }}
      align={align}
    >
      <div className={styles.renderer}>
        <span className={styles.chevron} aria-hidden="true">
          {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        </span>
        {value}
      </div>
    </TableCell>
  );
};

export default CellWithExpand;