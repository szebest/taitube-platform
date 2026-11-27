import { z } from 'zod';

export const CHANNEL_TABS = ['home', 'posts'] as const;

export type ChannelTab = (typeof CHANNEL_TABS)[number];

const TabSchema = z
  .unknown()
  .transform((value) => CHANNEL_TABS.find((tab) => tab === value))
  .optional();

/** Both channel routes: which section is open, the home when none is named or the name is not one. */
export const ChannelSearchSchema = z.object({ tab: TabSchema });
