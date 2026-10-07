import CircularProgress from "@mui/material/CircularProgress";

import styles from "./SessionPending.module.css";

type Props = {
  label: string;
};

/**
 * The progress affordance shown while a session is being verified, so a guard
 * never flashes the screen it is about to replace.
 */
const SessionPending = ({ label }: Props) => (
  <div className={styles.pending} role="status" aria-live="polite">
    <CircularProgress size={32} aria-label={label} />
    <span className={styles.pendingText}>{label}</span>
  </div>
);

export default SessionPending;