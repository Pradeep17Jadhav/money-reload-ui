"use client";

import { useCallback, useState } from "react";
import { Avatar, IconButton, Popover, Tooltip } from "@mui/material";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import { getInitials } from "@/helpers/initials";

import styles from "./ProfileMenu.module.css";
import type { ProfileMenuProps } from "./ProfileMenu.types";

/**
 * The account, behind one icon. The popover holds the identity and the only
 * sign-out affordance, so the toolbar itself carries nothing but the trigger.
 */
const ProfileMenu = ({ user, onSignOut }: ProfileMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const isOpen = Boolean(anchorEl);
  const initials = getInitials(user.firstName, user.lastName);
  const displayName = `${user.firstName} ${user.lastName}`.trim();

  const handleOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget),
    []
  );

  const handleClose = useCallback(() => setAnchorEl(null), []);

  const handleSignOut = useCallback(() => {
    setAnchorEl(null);
    onSignOut();
  }, [onSignOut]);

  return (
    <>
      <Tooltip title="Account">
        <IconButton
          className={styles.trigger}
          aria-label="Account"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={handleOpen}
          color="inherit"
        >
          <AccountCircleOutlinedIcon />
        </IconButton>
      </Tooltip>

      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { className: styles.paper } }}
      >
        <div className={styles.card}>
          <Avatar className={styles.avatar} sx={{ width: 56, height: 56, fontSize: 20 }}>
            {initials}
          </Avatar>

          <div className={styles.name}>{displayName}</div>
          <div className={styles.username}>@{user.username}</div>
          <div className={styles.email}>{user.email}</div>

          <button type="button" className={styles.signOut} onClick={handleSignOut}>
            <LogoutIcon fontSize="small" />
            Sign out
          </button>
        </div>
      </Popover>
    </>
  );
};

export default ProfileMenu;