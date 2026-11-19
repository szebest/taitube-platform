export interface AnalyticsResource {
  readonly ownerId: string;
  readonly channelId: string;
}

/** The stats panel of one video; its channel's analytics-read grant decides, so it carries the owner and the channel. */
export interface VideoStatsResource {
  readonly ownerId: string;
  readonly channelId: string;
}
