export interface AnalyticsResource {
  readonly ownerId: string;
}

/** The stats panel of one video; its channel's analytics-read grant decides, so it carries the owner. */
export interface VideoStatsResource {
  readonly ownerId: string;
}
