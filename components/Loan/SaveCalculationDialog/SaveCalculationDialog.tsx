"use client";

import { useCallback, useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import AuthBanner from "@/components/AuthPanel/AuthBanner";
import {
    CALCULATION_DESCRIPTION_MAX_LENGTH,
    CALCULATION_NAME_MAX_LENGTH,
} from "@/constants/calculations";

import styles from "./SaveCalculationDialog.module.css";

export type SaveCalculationValues = {
    name: string;
    description: string;
};

type Props = {
    open: boolean;
    isSaving: boolean;
    /** Form-level message, or null. */
    banner: string | null;
    /** Field-level messages keyed by the API's field name. */
    errors?: Record<string, string>;
    onClose: () => void;
    onSubmit: (values: SaveCalculationValues) => void;
};

const NAME_REQUIRED_MESSAGE = "Give this calculation a name so you can find it again.";

/**
 * Names a scenario and asks for a note about it. Nothing else about the loan is
 * editable here: the scenario is a snapshot of the calculator as it stands, so
 * changing a field would save something the user never saw.
 */
const SaveCalculationDialog = ({
    open,
    isSaving,
    banner,
    errors,
    onClose,
    onSubmit,
}: Props) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);

    // Reopened for a new scenario each time, so it must not open carrying the
    // last one's name or a message about it.
    useEffect(() => {
        if (!open) {
            return;
        }

        setName("");
        setDescription("");
        setNameError(null);
    }, [open]);

    const handleNameChange = useCallback((value: string) => {
        setName(value);
        // Cleared as soon as the user starts fixing it, rather than sitting
        // under a field they are actively typing into.
        setNameError((current) => (current === null ? current : null));
    }, []);

    const handleDescriptionChange = useCallback((value: string) => {
        setDescription(value);
    }, []);

    const handleSubmit = useCallback(() => {
        const trimmedName = name.trim();

        if (!trimmedName) {
            setNameError(NAME_REQUIRED_MESSAGE);
            return;
        }

        onSubmit({ name: trimmedName, description: description.trim() });
    }, [description, name, onSubmit]);

    // The API's own message wins, since it knows more about the name than a
    // local blank check does.
    const resolvedNameError = errors?.name ?? nameError;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            data-testid="save-calculation-dialog"
        >
            <DialogTitle>Save Calculations</DialogTitle>

            <DialogContent>
                <AuthBanner message={banner} />

                <div className={styles.field}>
                    <TextField
                        id="calculation-name"
                        label="Calculation name"
                        type="text"
                        variant="outlined"
                        size="small"
                        fullWidth
                        autoFocus
                        value={name}
                        onChange={(event) => handleNameChange(event.target.value)}
                        error={!!resolvedNameError}
                        helperText={resolvedNameError ?? " "}
                        disabled={isSaving}
                        slotProps={{
                            htmlInput: {
                                maxLength: CALCULATION_NAME_MAX_LENGTH,
                                "data-testid": "calculation-name-input",
                            },
                        }}
                    />
                </div>

                <div className={styles.field}>
                    <TextField
                        id="calculation-description"
                        label="Description"
                        variant="outlined"
                        size="small"
                        fullWidth
                        multiline
                        minRows={3}
                        value={description}
                        onChange={(event) => handleDescriptionChange(event.target.value)}
                        helperText="Optional. What this scenario assumes."
                        disabled={isSaving}
                        slotProps={{
                            htmlInput: {
                                maxLength: CALCULATION_DESCRIPTION_MAX_LENGTH,
                                "data-testid": "calculation-description-input",
                            },
                        }}
                    />
                </div>
            </DialogContent>

            <DialogActions className={styles.actions}>
                <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={onClose}
                    disabled={isSaving}
                    data-testid="save-calculation-cancel"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleSubmit}
                    // Disabled rather than silent: a blank name would otherwise
                    // do nothing at all, which reads as a broken button.
                    disabled={isSaving || name.trim().length === 0}
                    data-testid="save-calculation-submit"
                >
                    {isSaving && (
                        <CircularProgress size={16} thickness={5} aria-label="Saving" />
                    )}
                    Save
                </button>
            </DialogActions>
        </Dialog>
    );
};

export default SaveCalculationDialog;