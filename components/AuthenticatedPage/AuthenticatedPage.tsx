import RequireAuth from "@/components/RequireAuth/RequireAuth";

import styles from "./AuthenticatedPage.module.css";

type Props = {
  title: string;
  subtitle: string;
  /** Shown until each route gets its own UI. */
  placeholder: string;
  children?: React.ReactNode;
};

/**
 * The shell the private routes share, so a new one is a folder and an adapter
 * rather than a new layout. The guard sits here, which keeps every private route
 * behind the same check.
 */
const AuthenticatedPage = ({ title, subtitle, placeholder, children }: Props) => (
  <RequireAuth>
    <main className={styles.container}>
      <h1 className={styles.pageTitle}>{title}</h1>
      <h2 className={styles.pageSubtitle}>{subtitle}</h2>
      <div className={styles.placeholder}>{children ?? placeholder}</div>
    </main>
  </RequireAuth>
);

export default AuthenticatedPage;