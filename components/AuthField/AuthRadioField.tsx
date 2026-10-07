import { useCallback } from "react";
import classnames from "classnames";
import { Gender } from "@/types/AuthTypes";

import styles from "./AuthField.module.css";

type Props = {
  id: string;
  label: string;
  value: Gender | "";
  error?: string;
  onChange: (value: Gender) => void;
  onBlur?: () => void;
};

/** Friendly labels for the wire values. */
const GENDER_LABELS: { value: Gender; label: string }[] = [
  { value: Gender.FEMALE, label: "female" },
  { value: Gender.MALE, label: "male" },
  { value: Gender.OTHER, label: "other" },
];

/**
 * A small fixed choice set, rendered as pills. A radio group rather than a
 * select, because three options read better inline than behind a dropdown.
 */
const AuthRadioField = ({ id, label, value, error, onChange, onBlur }: Props) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value as Gender);
    },
    [onChange]
  );

  return (
    <div
      className={styles.field}
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      aria-describedby={error ? `${id}-message` : undefined}
      onBlur={onBlur}
    >
      <span id={`${id}-label`} className={styles.hint}>
        {label}
      </span>

      <div className={styles.radioRow}>
        {GENDER_LABELS.map((option) => {
          const isSelected = value === option.value;

          return (
            <label
              key={option.value}
              className={classnames(styles.radio, {
                [styles.radioSelected]: isSelected,
                [styles.radioError]: !!error,
              })}
            >
              <input
                type="radio"
                name={id}
                id={`${id}-${option.value}`}
                value={option.value}
                checked={isSelected}
                onChange={handleChange}
                className={styles.radioInput}
              />
              {option.label}
            </label>
          );
        })}
      </div>

      <p
        id={`${id}-message`}
        className={classnames(styles.message, {
          [styles.errorMessage]: !!error,
          [styles.hint]: !error,
        })}
      >
        {error ?? " "}
      </p>
    </div>
  );
};

export default AuthRadioField;