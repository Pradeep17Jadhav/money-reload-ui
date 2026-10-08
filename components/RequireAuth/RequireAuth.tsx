"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/authContext";
import { PATHS } from "@/constants/path";
import SessionPending from "@/components/SessionPending/SessionPending";

type Props = {
  children: React.ReactNode;
};

/**
 * Client-side guard for the private routes.
 *
 * Auth is a Bearer token held in browser storage, so there is no server session
 * for middleware to verify and nothing to check before the document is sent. The
 * guard waits for the stored session to be verified and only then decides, and
 * shows a progress affordance while it does so rather than a flash of the wrong
 * screen.
 */
const RequireAuth = ({ children }: Props) => {
  const { status } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (status !== "unauthenticated" || hasRedirected.current) {
      return;
    }

    // One navigation, even if the effect re-runs.
    hasRedirected.current = true;
    router.replace(PATHS.LOGIN);
  }, [router, status]);

  if (status !== "authenticated") {
    return (
      <SessionPending
        label={status === "initialising" ? "Checking your session" : "Redirecting to sign in"}
      />
    );
  }

  return <>{children}</>;
};

export default RequireAuth;