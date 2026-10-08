import type { AuthUser } from "@/types/AuthTypes";

export type ProfileMenuProps = {
  /** The signed-in account the popover describes. */
  user: AuthUser;
  /** Ends the session and leaves the popover. */
  onSignOut: () => void;
};