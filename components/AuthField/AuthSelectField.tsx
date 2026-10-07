import { useCallback } from "react";
import classnames from "classnames";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import type { CountryOption } from "@/helpers/countries";

import styles from "./AuthField.module.css";

type Props = {
  id: string;
  label: string;
  value: string;
  options: CountryOption[];
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

const AuthSelectField = ({ id, label, value, options, error, onChange, onBlur }: Props) => {
  const handleChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  return (
    <div className={styles.field}>
      <FormControl size="small" fullWidth error={!!error}>
        <InputLabel id={`${id}-label`}>{label}</InputLabel>
        <Select
          id={id}
          className={styles.select}
          labelId={`${id}-label`}
          label={label}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          error={!!error}
          aria-describedby={error ? `${id}-message` : undefined}
        >
          {options.map((option) => (
            <MenuItem key={option.code} value={option.code}>
              {option.name}
            </MenuItem>
          ))}
        </Select>
        <p
          id={`${id}-message`}
          className={classnames(styles.message, {
            [styles.errorMessage]: !!error,
            [styles.hint]: !error,
          })}
        >
          {error ?? " "}
        </p>
      </FormControl>
    </div>
  );
};

export default AuthSelectField;