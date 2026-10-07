import styles from "./AuthPanel.module.css";

type Props = {
  /** Null while there is nothing to report, so the slot collapses. */
  message: string | null;
};

/**
 * Form-level messages: a rejected sign-in, a rate limit, a server that could not
 * be reached. Anything attached to a single input belongs on that input instead.
 */
const AuthBanner = ({ message }: Props) => {
  if (!message) {
    return null;
  }

  return (
    <p className={styles.banner} role="alert">
      {message}
    </p>
  );
};

export default AuthBanner;