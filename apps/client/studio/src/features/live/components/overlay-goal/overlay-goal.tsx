import { useT } from '@vp/intl-react';
import { GoalBar } from '#app/components/live/goal-bar';
import { nextSubscriberGoal } from '#app/features/live/utils/subscriber-goal';

export interface OverlayGoalProps {
  subscriberCount: number;
}

/** The subscriber count against the next milestone. */
export function OverlayGoal({ subscriberCount }: OverlayGoalProps) {
  const { tOr } = useT();
  const goal = nextSubscriberGoal(subscriberCount);
  const label = tOr('studio.liveOverlayGoalLabel', {}, '');

  return (
    <GoalBar.Root>
      <GoalBar.Label>{label}</GoalBar.Label>
      <GoalBar.Count>
        {tOr('studio.liveOverlayGoalProgress', { count: subscriberCount, goal }, '')}
      </GoalBar.Count>
      <GoalBar.Bar aria-label={label} value={subscriberCount} max={goal} />
    </GoalBar.Root>
  );
}
