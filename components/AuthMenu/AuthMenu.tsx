"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, MenuItem } from "@mui/material";
import { useAuth } from "@/contexts/authContext";
import { getInitials } from "@/helpers/initials";
import { PATHS, PRIVATE_PATHS } from "@/constants/path";

import styles from "./AuthMenu.module.css";

type Props = {
  /**
   * `bar` renders inline in the toolbar; `menu` renders rows inside the mobile
   * navigation menu. One component so the two surfaces cannot drift apart.
   */
  variant: "bar" | "menu";
  /** Closes the mobile menu after a row is chosen. */
  onNavigate?: () => void;
};

const PRIVATE_LABELS: Record<string, string> = {
  [PATHS.PROFILE]: "Profile",
  [PATHS.LOANS]: "Loans",
  [PATHS.INCOME]: "Income",
  [PATHS.EXPENSES]: "Expenses",
  [PATHS.GOALS]: "Goals",
};

const AuthMenu = ({ variant, onNavigate }: Props) => {
  const { isSignedIn, status, user, signOut } = useAuth();
  const router = useRouter();

  const initials = getInitials(user?.firstName ?? "", user?.lastName ?? "");
  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "";

  const go = useCallback(
    (to: string) => {
      onNavigate?.();
      router.push(to);
    },
    [onNavigate, router]
  );

  const handleSignOut = useCallback(() => {
    onNavigate?.();
    void signOut();
    router.push(PATHS.HOME_PAGE);
  }, [onNavigate, router, signOut]);

  // Nothing is asserted about the session until it has been verified.
  if (status === "initialising") {
    return null;
  }

  if (variant === "menu") {
    if (!isSignedIn) {
      return (
        <>
          <MenuItem onClick={() => go(PATHS.LOGIN)}>
            <span>Sign in</span>
          </MenuItem>
          <MenuItem onClick={() => go(PATHS.REGISTER)}>
            <span>Create account</span>
          </MenuItem>
        </>
      );
    }

    return (
      <>
        {PRIVATE_PATHS.map((to) => (
          <MenuItem key={to} onClick={() => go(to)}>
            <span>{PRIVATE_LABELS[to]}</span>
          </MenuItem>
        ))}
        <MenuItem onClick={handleSignOut}>
          <span>Sign out</span>
        </MenuItem>
      </>
    );
  }

  if (!isSignedIn) {
    return (
      <div className={styles.authControls}>
        <Link className={styles.barLink} href={PATHS.LOGIN}>
          Sign in
        </Link>
        <button
          type="button"
          className={styles.barButton}
          onClick={() => go(PATHS.REGISTER)}
        >
          Create account
        </button>
      </div>
    );
  }

  return (
    <div className={styles.authControls}>
      <Avatar className={styles.avatar} aria-hidden="true">
        {initials}
      </Avatar>
      <span className={styles.userName}>{displayName}</span>
      <button type="button" className={styles.barButton} onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  );
};

export default AuthMenu;