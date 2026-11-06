const MILESTONES = [10, 25, 50, 100, 250, 500, 1000] as const;
const THOUSAND = 1000;

/** The next milestone above `count`: a fixed ladder to a thousand, then the next multiple of a thousand. */
export function nextSubscriberGoal(count: number): number {
  const milestone = MILESTONES.find((goal) => goal > count);
  return milestone ?? (Math.floor(count / THOUSAND) + 1) * THOUSAND;
}
