import { z } from 'zod';

export const SUBSCRIPTION_TABS = ['videos', 'community'] as const;

const TabSchema = z
  .unknown()
  .transform((value) => SUBSCRIPTION_TABS.find((tab) => tab === value))
  .optional();

/** `/subscriptions/videos`: which feed is open, the videos when none is named or the name is not one. */
export const SubscriptionSearchSchema = z.object({ tab: TabSchema });
