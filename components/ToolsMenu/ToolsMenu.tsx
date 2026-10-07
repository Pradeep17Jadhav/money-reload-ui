"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import classnames from "classnames";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { AnalyticsEventType, trackEvent } from "@/helpers/analytics";

import styles from "./ToolsMenu.module.css";
import type { ToolsMenuProps } from "./ToolsMenu.types";

/**
 * The tools the navbar would otherwise list one by one, behind a single item.
 *
 * It opens on hover and on keyboard focus, closes on Escape and when focus
 * leaves it, and is rendered in place rather than in a portal so the pointer
 * can travel from the trigger into the panel and focus follows document order.
 */
const ToolsMenu = ({ items, activePath }: ToolsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const toggle = useCallback(() => setIsOpen((current) => !current), []);

  const handleBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;

    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      close();
    }
  }, [close]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape") {
        return;
      }

      close();
      triggerRef.current?.focus();
    },
    [close]
  );

  const handleNavLinkClick = useCallback(() => {
    trackEvent(AnalyticsEventType.APPBAR_NAVIGATION);
    close();
  }, [close]);

  const hasActiveItem = items.some((item) => item.to === activePath);

  return (
    <div
      className={styles.tools}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        className={classnames(styles.trigger, {
          [styles.activeTrigger]: hasActiveItem,
        })}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={toggle}
      >
        Tools
        <ExpandMoreIcon
          fontSize="small"
          className={classnames(styles.caret, {
            [styles.openCaret]: isOpen,
          })}
        />
      </button>

      {isOpen ? (
        <ul className={styles.panel}>
          {items.map((item) => (
            <li key={item.to}>
              <Link
                href={item.to}
                onClick={handleNavLinkClick}
                className={classnames(styles.panelLink, {
                  [styles.activePanelLink]: item.to === activePath,
                })}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default ToolsMenu;