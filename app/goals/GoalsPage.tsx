"use client";

import RecordsPage from "@/components/Records/RecordsPage/RecordsPage";
import { useRecordCollection } from "@/hooks/Finance/useRecordCollection";
import { useRecordSummary } from "@/hooks/Finance/useRecordSummary";
import { useRecordsScreen } from "@/hooks/Finance/useRecordsScreen";
import {
  createGoal,
  deleteGoal,
  getGoalsSummary,
  listGoals,
  updateGoal,
} from "@/services/finance/records";
import type { Goal } from "@/types/FinanceTypes";
import {
  GOAL_COLUMNS,
  GOAL_FIELDS,
  GOAL_FILTERS,
  GOAL_SORT_OPTIONS,
  goalSummaryTiles,
} from "@/components/Goals/GoalsConfig";

const GoalsPage = () => {
  const collection = useRecordCollection<Goal>({
    list: listGoals,
    remove: deleteGoal,
  });

  const screen = useRecordsScreen<Goal>({
    fields: GOAL_FIELDS,
    // Progress is never submitted: the server owns progressPercent,
    // remainingAmount and daysRemaining, and rejects any request that sends them.
    recordToValues: (goal) => {
      const { progressPercent, remainingAmount, daysRemaining, ...editable } = goal;
      return editable as unknown as Record<string, unknown>;
    },
    getId: (goal) => goal.id,
    create: createGoal,
    update: updateGoal,
    remove: deleteGoal,
    onMutated: collection.refetch,
  });

  const { summary, isLoading, error } = useRecordSummary(getGoalsSummary, collection.query, collection.reloadToken);

  return (
    <RecordsPage
      title="Goals"
      subtitle="What you are saving towards, and how far along you are."
      addLabel="Add goal"
      submitLabel="add goal"
      editSubmitLabel="save changes"
      emptyMessage="No goals yet. Add one to start tracking what you are saving for."
      caption="goal"
      deleteMessage="This goal will be removed from your records and from every total. It cannot be undone from here."
      columns={GOAL_COLUMNS}
      sortOptions={GOAL_SORT_OPTIONS}
      filters={GOAL_FILTERS}
      summaryTiles={goalSummaryTiles(summary)}
      summaryError={error}
      isSummaryLoading={isLoading}
      collection={collection}
      screen={screen}
    />
  );
};

export default GoalsPage;