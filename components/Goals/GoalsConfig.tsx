import { formatDateOnly } from "@/helpers/dates";
import { formatPaise } from "@/helpers/money";
import { Badge, CellStack } from "@/components/Records/RecordTable/RecordTable";
import type { TableColumn } from "@/components/Records/RecordTable/RecordTable";
import {
  GOAL_CATEGORY_OPTIONS,
  GOAL_PRIORITY_OPTIONS,
  GOAL_PRIORITY_TONE,
  GOAL_SORTS,
  GOAL_STATUS_OPTIONS,
  GOAL_STATUS_TONE,
  labelForEnumValue,
  sortOptions,
} from "@/constants/records";
import type { MultiFilter } from "@/components/Records/RecordToolbar/RecordToolbar";
import type { SummaryTile } from "@/components/Records/SummaryTiles/SummaryTiles";
import type { FieldConfig } from "@/types/RecordFormTypes";
import type { Goal, GoalsSummary } from "@/types/FinanceTypes";

/**
 * `progressPercent`, `remainingAmount` and `daysRemaining` are absent from this
 * field list on purpose: the server computes them and rejects any request that
 * sends them. The progress column below only reads them.
 */
export const GOAL_FIELDS: FieldConfig[] = [
  { kind: "text", name: "title", label: "title", required: true, minLength: 1, maxLength: 150 },
  { kind: "money", name: "targetAmount", label: "target amount", required: true },
  { kind: "money", name: "currentAmount", label: "saved so far", allowZero: true },
  { kind: "date", name: "targetDate", label: "target date", required: true },
  { kind: "money", name: "monthlyContribution", label: "monthly contribution" },
  { kind: "select", name: "category", label: "category", options: GOAL_CATEGORY_OPTIONS },
  { kind: "select", name: "priority", label: "priority", options: GOAL_PRIORITY_OPTIONS },
  { kind: "select", name: "status", label: "status", options: GOAL_STATUS_OPTIONS },
  { kind: "text", name: "description", label: "description", maxLength: 1000, multiline: true },
  { kind: "text", name: "notes", label: "notes", maxLength: 2000, multiline: true },
];

export const GOAL_COLUMNS: TableColumn<Goal>[] = [
  {
    key: "title",
    header: "Goal",
    render: (goal) => <CellStack primary={goal.title} secondary={labelForEnumValue(goal.category)} />,
  },
  { key: "target", header: "Target", numeric: true, render: (goal) => formatPaise(goal.targetAmount) },
  { key: "saved", header: "Saved", numeric: true, render: (goal) => formatPaise(goal.currentAmount) },
  { key: "remaining", header: "Remaining", numeric: true, render: (goal) => formatPaise(goal.remainingAmount) },
  {
    key: "progress",
    header: "Progress",
    numeric: true,
    render: (goal) => `${goal.progressPercent}%`,
  },
  {
    key: "targetDate",
    header: "Target date",
    render: (goal) => (
      <CellStack
        primary={formatDateOnly(goal.targetDate)}
        secondary={
          goal.daysRemaining >= 0
            ? `${goal.daysRemaining} days left`
            : `${Math.abs(goal.daysRemaining)} days past`
        }
      />
    ),
  },
  {
    key: "priority",
    header: "Priority",
    render: (goal) => (
      <Badge tone={GOAL_PRIORITY_TONE[goal.priority]}>{labelForEnumValue(goal.priority)}</Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (goal) => (
      <Badge tone={GOAL_STATUS_TONE[goal.status]}>{labelForEnumValue(goal.status)}</Badge>
    ),
  },
];

export const GOAL_FILTERS: MultiFilter[] = [
  { key: "status", label: "Status", options: GOAL_STATUS_OPTIONS },
  { key: "priority", label: "Priority", options: GOAL_PRIORITY_OPTIONS },
  { key: "category", label: "Category", options: GOAL_CATEGORY_OPTIONS },
];

export const GOAL_SORT_OPTIONS = sortOptions(GOAL_SORTS);

export const goalSummaryTiles = (summary: GoalsSummary | null): SummaryTile[] => {
  if (!summary) {
    return [];
  }

  return [
    { label: "Targeted", value: formatPaise(summary.totalTargetAmount) },
    { label: "Saved", value: formatPaise(summary.totalCurrentAmount) },
    { label: "Still needed", value: formatPaise(summary.totalRemainingAmount) },
    {
      label: "Overall progress",
      value: `${summary.overallProgressPercent}%`,
      subValue: `${summary.activeGoals} active of ${summary.totalGoals}`,
    },
  ];
};