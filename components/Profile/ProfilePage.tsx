"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import classnames from "classnames";
import { Avatar } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import RequireAuth from "@/components/RequireAuth/RequireAuth";
import SessionPending from "@/components/SessionPending/SessionPending";
import { useAuth } from "@/contexts/authContext";
import { getInitials } from "@/helpers/initials";
import { getCountryName } from "@/helpers/countries";
import { formatPaise } from "@/helpers/money";
import { formatTimestamp, humaniseEnumValue } from "@/helpers/dates";
import { NO_FILTERS, useRecordSummary } from "@/hooks/Finance/useRecordSummary";
import {
  getExpensesSummary,
  getGoalsSummary,
  getIncomesSummary,
  getLoansSummary,
} from "@/services/finance/records";
import { PATHS } from "@/constants/path";
import type {
  ExpensesSummary,
  GoalsSummary,
  IncomesSummary,
  LoansSummary,
} from "@/types/FinanceTypes";

import styles from "./Profile.module.css";

type OverviewState = {
  loans: LoansSummary | null;
  incomes: IncomesSummary | null;
  expenses: ExpensesSummary | null;
  goals: GoalsSummary | null;
};

const TILES: (overview: OverviewState) => {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative";
}[] = (overview) => {
  const totalIncome = overview.incomes?.totalIncome ?? 0;
  const totalExpense = overview.expenses?.totalExpense ?? 0;
  // Both are already integer paise, so the surplus stays exact.
  const surplus = totalIncome - totalExpense;

  return [
    {
      label: "Total income",
      value: formatPaise(overview.incomes ? totalIncome : null),
      sub: overview.incomes ? `${overview.incomes.recordCount} entries` : undefined,
    },
    {
      label: "Total expenses",
      value: formatPaise(overview.expenses ? totalExpense : null),
      sub: overview.expenses ? `${overview.expenses.recordCount} entries` : undefined,
    },
    {
      label: overview.incomes && overview.expenses ? "Income less expenses" : "Surplus",
      value:
        overview.incomes && overview.expenses
          ? formatPaise(surplus)
          : formatPaise(null),
      // Only meaningful when both sides of the subtraction exist.
      sub:
        overview.incomes && overview.expenses
          ? surplus >= 0
            ? "more in than out"
            : "more out than in"
          : undefined,
      tone: surplus < 0 ? "negative" : "positive",
    },
    {
      label: "Total borrowed",
      value: formatPaise(overview.loans ? overview.loans.totalPrincipal : null),
      sub: overview.loans
        ? `${overview.loans.activeLoans} active of ${overview.loans.totalLoans}`
        : undefined,
    },
    {
      label: "Monthly EMI",
      value: formatPaise(overview.loans ? overview.loans.totalEmi : null),
      sub: "across all active loans",
    },
    {
      label: "Goal progress",
      value: overview.goals ? `${overview.goals.overallProgressPercent}%` : "-",
      sub: overview.goals
        ? `${overview.goals.achievedGoals} of ${overview.goals.totalGoals} achieved`
        : undefined,
    },
  ];
};

/**
 * The account page.
 *
 * The overview is assembled client-side from the four `/summary` endpoints,
 * because the API offers no combined dashboard route. Income less expenses is a
 * plain subtraction of two integers the server already returned, not a
 * recomputation of anything.
 *
 * There are no cross-resource links in this API: an expense cannot be attached
 * to a goal, so goal progress comes from each goal's own `currentAmount`.
 */
const ProfilePage = () => {
  const { user, status } = useAuth();

  const loans = useRecordSummary(getLoansSummary, NO_FILTERS);
  const incomes = useRecordSummary(getIncomesSummary, NO_FILTERS);
  const expenses = useRecordSummary(getExpensesSummary, NO_FILTERS);
  const goals = useRecordSummary(getGoalsSummary, NO_FILTERS);

  const isLoading =
    loans.isLoading || incomes.isLoading || expenses.isLoading || goals.isLoading;

  const overview = useMemo<OverviewState>(
    () => ({
      loans: loans.summary,
      incomes: incomes.summary,
      expenses: expenses.summary,
      goals: goals.summary,
    }),
    [expenses.summary, goals.summary, incomes.summary, loans.summary]
  );

  const tiles = useMemo(() => TILES(overview), [overview]);
  const initials = getInitials(user?.firstName ?? "", user?.lastName ?? "");
  const memberSince = formatTimestamp(user?.createdAt);

  const sections = [
    { to: PATHS.LOANS, label: "Loans" },
    { to: PATHS.INCOME, label: "Income" },
    { to: PATHS.EXPENSES, label: "Expenses" },
    { to: PATHS.GOALS, label: "Goals" },
  ];

  return (
    <RequireAuth>
      {status === "initialising" || !user ? (
        <SessionPending label="Loading your profile" />
      ) : (
        <main className={styles.container}>
          <h1 className={styles.pageTitle}>Profile</h1>
          <h2 className={styles.pageSubtitle}>Your account and your finances at a glance.</h2>

          <section className={styles.identity} data-testid="profile-identity">
            <Avatar className={styles.avatar} sx={{ width: 72, height: 72, fontSize: 28 }}>
              {initials}
            </Avatar>
            <div className={styles.identityText}>
              <div className={styles.identityName}>
                {user.firstName} {user.lastName}
              </div>
              <div className={styles.identityMeta}>
                {user.email} · @{user.username}
              </div>
              <div className={styles.identityMeta}>
                {getCountryName(user.country) || user.country} ·{" "}
                {humaniseEnumValue(user.gender)}
              </div>
              <div className={styles.identityMeta}>Member since {memberSince}</div>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Financial overview</h3>
            <p className={styles.sectionSubtitle}>
              Totals across every record you have not deleted. Narrow any of them with the date
              filters on the pages below.
            </p>

            {isLoading ? (
              <div className={styles.overviewLoading} role="status" aria-live="polite">
                <CircularProgress size={28} aria-label="Loading your financial overview" />
              </div>
            ) : (
              <div className={styles.grid} data-testid="profile-overview">
                {tiles.map((tile) => (
                  <div
                    className={styles.tile}
                    key={tile.label}
                    data-testid={`profile-tile-${tile.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    <span className={styles.tileLabel}>{tile.label}</span>
                    <span
                      className={classnames(styles.tileValue, {
                        [styles.positive]: tile.tone === "positive" && tile.value !== "-",
                        [styles.negative]: tile.tone === "negative",
                      })}
                    >
                      {tile.value}
                    </span>
                    {tile.sub ? <span className={styles.tileSub}>{tile.sub}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Your records</h3>
            <p className={styles.sectionSubtitle}>
              Each page has its own table and totals.
            </p>
            <div className={styles.links}>
              {sections.map((section) => (
                <Link className={styles.link} key={section.to} href={section.to}>
                  {section.label}
                </Link>
              ))}
            </div>
          </section>
        </main>
      )}
    </RequireAuth>
  );
};

export default ProfilePage;