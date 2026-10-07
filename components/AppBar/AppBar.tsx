"use client";

import React, { useState, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import classnames from "classnames";
import {
  IconButton,
  Menu,
  MenuItem,
  Box,
  Typography,
  Container,
  Toolbar,
  Tooltip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import Link from "next/link";
import Logo from "../Logo/Logo";
import { PATHS } from "@/constants/path";
import CurrencySelector from "../CurrencySelector/CurrencySelector";
import AuthMenu from "../AuthMenu/AuthMenu";
import { useCurrency } from "@/contexts/currency";
import { AnalyticsEventType, trackEvent } from "@/helpers/analytics";

import styles from "./AppBar.module.css";

const AppBar = () => {
  const { isINR, currency } = useCurrency();
  const router = useRouter();
  const pathname = usePathname();
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);

  const handleOpenNavMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) =>
      setAnchorElNav(event.currentTarget),
    []
  );

  const handleCloseNavMenu = useCallback(
    (to: string) => () => {
      setAnchorElNav(null);
      if (to) {
        router.push(to);
      }
    },
    [router]
  );

  const handleNavLinkClick = useCallback(() => {
    trackEvent(AnalyticsEventType.APPBAR_NAVIGATION);
  }, []);

  const publicPages = useMemo(
    () => [
      {
        to: "/calculators",
        label: "Calculators",
        tooltip: "Calculators",
        enabled: true,
      },
      {
        to: "/blog",
        label: "Blog",
        tooltip: "Read our blogs",
        enabled: true,
      },
      {
        to: "/income-tax-calculator",
        label: "Income Tax",
        tooltip: "Income Tax Calculator",
        enabled: isINR,
      },
      {
        to: "/sip-calculator",
        label: "SIP",
        tooltip: "SIP Calculator",
        enabled: true,
      },
      {
        to: "/lumpsum-calculator",
        label: "Lumpsum",
        tooltip: "Lumpsum Calculator",
        enabled: true,
      },
      {
        to: "/fd-calculator",
        label: "Fixed Deposit",
        tooltip: "FD Calculator",
        enabled: true,
      },
      {
        to: "/rd-calculator",
        label: "Recurring Deposit",
        tooltip: "RD Calculator",
        enabled: true,
      },
      {
        to:
          currency === "USD" ? "/mortgage-calculator" : "/loan-emi-calculator",
        label: currency === "USD" ? "Mortgage" : "Loan",
        tooltip: currency === "USD" ? "Mortgage Calculator" : "Loan Calculator",
        enabled: true,
      },
    ],
    [isINR, currency]
  );

  const privatePages = useMemo(
    () => [
      {
        to: "/addBlog",
        label: "Add Blog",
        tooltip: "Add Blog",
        enabled: process.env.NODE_ENV === "development",
      },
    ],
    []
  );

  return (
    <Container className={styles.appbarContainer} maxWidth={false}>
      <Toolbar className={styles.appbarToolbar} disableGutters>
        <Box sx={{ flexGrow: 0, display: { xs: "block", md: "none" } }}>
          <IconButton
            size="large"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleOpenNavMenu}
            color="inherit"
          >
            <MenuIcon />
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorElNav}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "left",
            }}
            keepMounted
            transformOrigin={{
              vertical: "top",
              horizontal: "left",
            }}
            open={Boolean(anchorElNav)}
            onClose={handleCloseNavMenu("")}
            sx={{ display: { xs: "block", md: "none" } }}
          >
            {publicPages.map((page) =>
              page.enabled ? (
                <MenuItem
                  key={page.label}
                  onClick={handleCloseNavMenu(page.to)}
                >
                  <Typography sx={{ textAlign: "center" }}>
                    {page.label}
                  </Typography>
                </MenuItem>
              ) : null
            )}
            <AuthMenu variant="menu" onNavigate={handleCloseNavMenu("")} />
          </Menu>
        </Box>

        <div className={styles.logoContainer}>
          <Tooltip title="Homepage">
            <Link className={styles.logoLink} href={PATHS.HOME_PAGE}>
              <Logo className={styles.logo} />
              <div className={styles.logoText}>
                Money<span className={styles.highlighted}>Reload</span>
              </div>
            </Link>
          </Tooltip>
        </div>

        <Box
          className={styles.navLinkContainer}
          sx={{ flexGrow: 0, display: { xs: "none", md: "flex" } }}
        >
          {publicPages.map(({ label, tooltip, to, enabled }) => {
            const isActive = pathname === to;
            return enabled ? (
              <Tooltip key={label} title={tooltip}>
                <Link
                  href={to}
                  onClick={handleNavLinkClick}
                  className={classnames(styles.navLink, {
                    [styles.activeNavLink]: isActive,
                  })}
                >
                  {label}
                </Link>
              </Tooltip>
            ) : null;
          })}
        </Box>

        <Box
          className={styles.navLinkContainer}
          sx={{ flexGrow: 0, display: { xs: "none", md: "flex" } }}
        >
          {privatePages.map(({ label, tooltip, to, enabled }) => {
            const isActive = pathname === to;
            return enabled ? (
              <Tooltip key={label} title={tooltip}>
                <Link
                  href={to}
                  onClick={handleNavLinkClick}
                  className={classnames(styles.navLink, {
                    [styles.activeNavLink]: isActive,
                  })}
                >
                  {label}
                </Link>
              </Tooltip>
            ) : null;
          })}
        </Box>

        <Box
          className={styles.navLinkContainer}
          sx={{ flexGrow: 0, display: { xs: "none", md: "flex" } }}
        >
          <AuthMenu variant="bar" />
        </Box>

        <CurrencySelector />
      </Toolbar>
    </Container>
  );
};

export default AppBar;
