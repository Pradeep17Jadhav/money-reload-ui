import { useCallback, useId } from "react";
import Link from "next/link";
import CircularProgress from "@mui/material/CircularProgress";
import AuthBanner from "./AuthBanner";

import styles from "./AuthPanel.module.css";

type Props = {
  title: string;
  subtitle: string;
  /** Form-level message, or null. */
  banner: string | null;
  /** Called with the browser form event. Must be prevented by the caller. */
  onSubmit: () => void;
  /** True from the first submission onward, so submit is never re-enabled. */
  isSubmitting: boolean;
  isValid: boolean;
  submitLabel: string;
  switchPrompt: string;
  switchHref: string;
  switchLabel: string;
  children: React.ReactNode;
};

/**
 * The shell both auth screens share: same geometry, same heading treatment, same
 * switch-link position. Only the fields inside it differ.
 */
const AuthPanel = ({
  title,
  subtitle,
  banner,
  onSubmit,
  isSubmitting,
  isValid,
  submitLabel,
  switchPrompt,
  switchHref,
  switchLabel,
  children,
}: Props) => {
  const panelId = useId();

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      // Native submit semantics are kept, so Enter works from any field.
      event.preventDefault();
      onSubmit();
    },
    [onSubmit]
  );

  // Disabled until the form is valid, and never re-enabled once submitted.
  const isSubmitDisabled = !isValid || isSubmitting;

  return (
    <div className={styles.page}>
      <div className={styles.panel} aria-labelledby={`${panelId}-title`}>
        <header className={styles.header}>
          <h1 className={styles.title} id={`${panelId}-title`}>
            {title}
          </h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </header>

        <AuthBanner message={banner} />

        <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
          <div className={styles.fields}>{children}</div>

          <div className={styles.submit}>
            <button type="submit" className={styles.submitButton} disabled={isSubmitDisabled}>
              {isSubmitting ? (
                <>
                  <CircularProgress
                    className={styles.spinner}
                    size={18}
                    thickness={5}
                    aria-label={submitLabel}
                  />
                  <span>{submitLabel}</span>
                </>
              ) : (
                <span>{submitLabel}</span>
              )}
            </button>
          </div>
        </form>

        <p className={styles.switch}>
          {switchPrompt}{" "}
          <Link className={styles.switchLink} href={switchHref}>
            {switchLabel}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthPanel;