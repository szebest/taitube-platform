export type UserTier = 'free' | 'pro' | 'enterprise';

/** BullMQ runs the lower number first, so a paid owner's job overtakes a free one's. */
export const JOB_PRIORITY = { paid: 1, free: 5 } as const;

export type JobPriority = (typeof JOB_PRIORITY)[keyof typeof JOB_PRIORITY];

/** An owner whose tier could not be read is treated as free: it costs the job its lane, not its place. */
export function jobPriorityFor(tier: UserTier | undefined): JobPriority {
  return tier === 'pro' || tier === 'enterprise' ? JOB_PRIORITY.paid : JOB_PRIORITY.free;
}
