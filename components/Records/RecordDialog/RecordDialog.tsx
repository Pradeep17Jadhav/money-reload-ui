import type { ReactNode } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import AuthBanner from "@/components/AuthPanel/AuthBanner";

import styles from "./RecordDialog.module.css";

type Props = {
  open: boolean;
  title: string;
  /** Form-level message, or null. */
  banner: string | null;
  isSubmitting: boolean;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
};

/**
 * The modal shell shared by create and edit. Keeping the table visible behind it
 * means the row being edited stays in context.
 */
const RecordDialog = ({
  open,
  title,
  banner,
  isSubmitting,
  submitLabel,
  onClose,
  onSubmit,
  children,
}: Props) => (
  <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      data-testid="record-dialog"
    >
      <DialogTitle className={styles.dialogTitle}>{title}</DialogTitle>

      <DialogContent className={styles.dialogBody} data-testid="record-dialog-body">
        <AuthBanner message={banner} />
        {children}
      </DialogContent>

    <DialogActions className={styles.actions}>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={onClose}
        disabled={isSubmitting}
        data-testid="record-cancel"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="record-form"
        className={styles.primaryButton}
        onClick={onSubmit}
        disabled={isSubmitting}
        data-testid="record-submit"
      >
        {isSubmitting && <CircularProgress size={16} thickness={5} aria-label="Saving" />}
        {submitLabel}
      </button>
    </DialogActions>
  </Dialog>
);

export default RecordDialog;