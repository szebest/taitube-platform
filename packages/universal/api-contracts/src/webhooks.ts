import { WEBHOOK_EVENTS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { WEBHOOK_URL_MAX_LENGTH } from '@vp/validation';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

const WebhookIdParamSchema = z.object({ id: z.uuid({ error: 'Invalid webhook ID format' }) });

const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);

const WebhookSchema = z.object({
  id: z.uuid().describe('Webhook UUIDv7 identifier'),
  url: z.string().describe('Where deliveries are POSTed'),
  events: z.array(WebhookEventSchema).describe('The events it is told about'),
  createdAt: z.iso.datetime().describe('ISO 8601 creation timestamp'),
});

const CreatedWebhookSchema = WebhookSchema.extend({
  secret: z
    .string()
    .describe('The HMAC-SHA256 key of this webhook. Shown here once and never returned again'),
});

const WebhookListSchema = z.object({ items: z.array(WebhookSchema) });

const CreateWebhookBodySchema = z.object({
  url: z
    .string()
    .max(WEBHOOK_URL_MAX_LENGTH)
    .describe('https, on a public host, without credentials'),
  events: z
    .array(WebhookEventSchema)
    .min(1)
    .max(WEBHOOK_EVENTS.length)
    .describe('video.ready fires when processing finishes; live.started is accepted and reserved'),
});

const AUTHENTICATED = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
} as const;

export const createWebhook = defineEndpoint({
  method: 'POST',
  path: '/v1/me/webhooks',
  tag: 'Webhooks',
  summary: 'Register a webhook',
  description:
    'Registers an outgoing webhook for the caller. The response carries its signing secret, which is shown once. Each delivery is a POST of a JSON body with `X-Taitube-Event`, `X-Taitube-Delivery` (also sent as `Idempotency-Key`), `X-Taitube-Timestamp` and `X-Taitube-Signature-256: sha256=<hex>`, the HMAC-SHA256 of `<timestamp>.<body>` under the secret. One attempt, five seconds, no redirects followed. At most 10 per user.',
  body: CreateWebhookBodySchema,
  status: 201,
  result: CreatedWebhookSchema,
  errors: {
    ...AUTHENTICATED,
    409: [ErrorCodes.WEBHOOK_LIMIT_REACHED],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const listWebhooks = defineEndpoint({
  method: 'GET',
  path: '/v1/me/webhooks',
  tag: 'Webhooks',
  summary: 'List my webhooks',
  description: 'The webhooks the caller registered, oldest first. Secrets are never returned.',
  status: 200,
  result: WebhookListSchema,
  errors: { 401: [ErrorCodes.UNAUTHORIZED] },
});

export const deleteWebhook = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/webhooks/:id',
  tag: 'Webhooks',
  summary: 'Remove a webhook',
  description: 'Answers 404 for a webhook the caller did not register.',
  params: WebhookIdParamSchema,
  status: 204,
  result: z.null().describe('Webhook removed'),
  errors: { ...AUTHENTICATED, 404: [ErrorCodes.WEBHOOK_NOT_FOUND] },
});

export type WebhookView = z.infer<typeof WebhookSchema>;
export type CreatedWebhookView = z.infer<typeof CreatedWebhookSchema>;
export type WebhookListView = z.infer<typeof WebhookListSchema>;
export type CreateWebhookBody = z.infer<typeof CreateWebhookBodySchema>;
