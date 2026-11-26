/** What a live share link proves: its holder may watch that one target, and nothing else. */
export interface ShareGrant {
  readonly targetType: 'video';
  readonly targetId: string;
}
