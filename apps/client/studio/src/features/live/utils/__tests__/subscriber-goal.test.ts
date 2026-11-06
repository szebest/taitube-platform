import { nextSubscriberGoal } from '../subscriber-goal';

describe('apps/client/studio: nextSubscriberGoal', () => {
  it.each([
    { count: 0, goal: 10 },
    { count: 9, goal: 10 },
    { count: 10, goal: 25 },
    { count: 49, goal: 50 },
    { count: 99, goal: 100 },
    { count: 100, goal: 250 },
    { count: 499, goal: 500 },
    { count: 500, goal: 1000 },
    { count: 999, goal: 1000 },
    { count: 1000, goal: 2000 },
    { count: 2999, goal: 3000 },
    { count: 12_345, goal: 13_000 },
  ])('aims $count subscribers at $goal', ({ count, goal }) => {
    expect(nextSubscriberGoal(count)).toBe(goal);
  });
});
