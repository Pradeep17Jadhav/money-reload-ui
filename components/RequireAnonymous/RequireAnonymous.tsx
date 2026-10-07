"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/authContext";
import { PATHS } from "@/constants/path";
import SessionPending from "@/components/SessionPending/SessionPending";

type Props = {
  children: React.ReactNode;
};

/**
 * Keeps the sign-in and registration screens away from users who already have a
 * session, including one restored on load. Shared so both routes behave
 * identically and neither flashes a form the user cannot use.
 */
const RequireAnonymous = ({ children }: Props) => {
  const { status } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || hasRedirected.current) {
      return;
    }

    hasRedirected.current = true;
    setIsRedirecting(true);
    router.replace(PATHS.PROFILE);
  }, [router, status]);

  // Held until the navigation lands, so the form is never shown to someone who
  // cannot use it.
  if (status === "initialising" || isRedirecting) {
    return <SessionPending label="Checking your session" />;
  }

  return <>{children}</>;
};

export default RequireAnonymous;