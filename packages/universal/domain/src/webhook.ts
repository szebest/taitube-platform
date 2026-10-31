/** `live.started` is accepted and stored; nothing emits it until a live backend exists. */
export const WEBHOOK_EVENTS = ['video.ready', 'live.started'] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const MAX_WEBHOOKS_PER_USER = 10;

export interface Webhook {
  id: string;
  ownerId: string;
  url: string;
  events: WebhookEvent[];
  /** The HMAC key of every delivery to this webhook; shown to its owner once, at creation. */
  secret: string;
  createdAt: Date;
}
