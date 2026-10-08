import { useCallback, useState } from "react";
import classnames from "classnames";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import styles from "./AuthField.module.css";

type Props = {
  id: string;
  label: string;
  value: string;
  /** Rendered under the input, in the reserved message slot. */
  helperText?: string;
  error?: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: "text" | "email" | "numeric";
  maxLength?: number;
  withVisibilityToggle?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

/**
 * A labelled text input with a reserved message slot.
 *
 * `helperText` and `error` are mutually exclusive; when there is no error the
 * slot still holds its height so the form does not jump.
 */
const AuthField = ({
  id,
  label,
  value,
  helperText,
  error,
  type = "text",
  autoComplete,
  autoFocus,
  inputMode,
  maxLength,
  withVisibilityToggle = false,
  onChange,
  onBlur,
}: Props) => {
  const [isRevealed, setIsRevealed] = useState(false);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  const toggleReveal = useCallback(() => {
    setIsRevealed((revealed) => !revealed);
  }, []);

  const messageClassName = classnames(styles.message, {
    [styles.errorMessage]: !!error,
    [styles.hint]: !error,
  });

  return (
    <div className={styles.field}>
      <TextField
        id={id}
        className={styles.input}
        label={label}
        variant="outlined"
        size="small"
        fullWidth
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        type={withVisibilityToggle && isRevealed ? "text" : type}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        inputMode={inputMode}
        error={!!error}
        // Always a string, so the slot reserves its height when there is no
        // message to show. `error` gives the input `aria-invalid` and points
        // `aria-describedby` at this element.
        helperText={error || helperText || " "}
        slotProps={{
          input: {
            endAdornment: withVisibilityToggle ? (
              <InputAdornment position="end">
                <IconButton
                  className={styles.toggle}
                  size="small"
                  onClick={toggleReveal}
                  edge="end"
                  aria-label={isRevealed ? `hide ${label}` : `show ${label}`}
                  aria-pressed={isRevealed}
                >
                  {isRevealed ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
          htmlInput: { maxLength },
          formHelperText: { className: messageClassName },
        }}
      />
    </div>
  );
};

export default AuthField;