import {
  NOTIFICATION_FILTERS,
  NOTIFICATION_KINDS,
  type NotificationReadScope,
  type NotificationView,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

const NotificationPayloadSchema = z.object({
  count: z.number().int().positive().describe('Events folded into this row, 1 for a single one'),
  actor: z
    .object({
      handle: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable()
    .describe('The newest actor: the channel that published, or whoever commented'),
  videoTitle: z.string().nullable(),
  excerpt: z.string().nullable().describe('The start of the comment, for comment kinds'),
  outcome: z.enum(['ready', 'failed']).nullable().describe('How an upload finished'),
});

export const NotificationSchema = z.object({
  id: z.uuid(),
  kind: z.enum(NOTIFICATION_KINDS),
  actorChannelId: z.uuid().nullable(),
  videoId: z.uuid().nullable(),
  commentId: z.uuid().nullable(),
  payload: NotificationPayloadSchema,
  read: z.boolean(),
  createdAt: z.iso.datetime(),
}) satisfies z.ZodType<NotificationView>;

const ListNotificationsQuerySchema = KeysetQuerySchema.extend({
  filter: z.enum(NOTIFICATION_FILTERS).default('all'),
});

const ListNotificationsResponseSchema = z.object({
  items: z.array(NotificationSchema),
  nextCursor: z.string().nullable(),
});

const UnreadCountSchema = z.object({ unreadCount: z.number().int().nonnegative() });

const MarkNotificationsReadBodySchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(100).optional(),
    all: z.literal(true).optional(),
  })
  .refine((body) => (body.ids === undefined) !== (body.all === undefined), {
    message: 'Send either ids or all',
  });
export type MarkNotificationsReadBody = z.infer<typeof MarkNotificationsReadBodySchema>;

export function readScopeOf(body: MarkNotificationsReadBody): NotificationReadScope {
  return body.ids === undefined ? { scope: 'all' } : { scope: 'ids', ids: body.ids };
}

export const listNotifications = defineEndpoint({
  method: 'GET',
  path: '/v1/me/notifications',
  tag: 'Notifications',
  summary: 'List the caller notifications',
  description:
    'Keyset-paginated, newest first. `filter` narrows to subscription notifications (uploads and live) or to replies and mentions. A group of events from one channel inside an hour is one row with a `payload.count`.',
  query: ListNotificationsQuerySchema,
  status: 200,
  result: ListNotificationsResponseSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export const getUnreadNotificationCount = defineEndpoint({
  method: 'GET',
  path: '/v1/me/notifications/unread-count',
  tag: 'Notifications',
  summary: 'Count the caller unread notifications',
  description: 'The number behind the bell badge.',
  status: 200,
  result: UnreadCountSchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export const markNotificationsRead = defineEndpoint({
  method: 'POST',
  path: '/v1/me/notifications/read',
  tag: 'Notifications',
  summary: 'Mark notifications as read',
  description:
    'Marks the given ids, or every notification with `all`, as read. Emits `notification.read` on the user event stream so the caller other tabs and devices clear their badge.',
  body: MarkNotificationsReadBodySchema,
  status: 200,
  result: UnreadCountSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
  },
});

export type Notification = z.infer<typeof NotificationSchema>;
