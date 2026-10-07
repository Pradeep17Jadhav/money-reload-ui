"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MenuItem } from "@mui/material";
import ProfileMenu from "@/components/ProfileMenu/ProfileMenu";
import { useAuth } from "@/contexts/authContext";
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
      // Registration lives behind the sign-in page, so one row is enough here.
      return (
        <MenuItem onClick={() => go(PATHS.LOGIN)}>
          <span>Sign in</span>
        </MenuItem>
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

  if (!isSignedIn || !user) {
    return (
      <div className={styles.authControls}>
        <Link className={styles.barButton} href={PATHS.LOGIN}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.authControls}>
      <ProfileMenu user={user} onSignOut={handleSignOut} />
    </div>
  );
};

export default AuthMenu;