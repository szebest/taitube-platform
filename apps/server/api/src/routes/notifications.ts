import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationsRead,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  const { notificationService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listNotifications.path,
    { schema: { ...contractSchema(listNotifications), querystring: listNotifications.query } },
    async (request, reply) => {
      const viewer = requireAuth(request);
      return sendResult(reply, request, await notificationService.list(viewer, request.query));
    }
  );

  server.get(
    getUnreadNotificationCount.path,
    { schema: contractSchema(getUnreadNotificationCount) },
    async (request, reply) => {
      const viewer = requireAuth(request);
      return sendResult(reply, request, await notificationService.unreadCount(viewer));
    }
  );

  server.post(
    markNotificationsRead.path,
    { schema: { ...contractSchema(markNotificationsRead), body: markNotificationsRead.body } },
    async (request, reply) => {
      const editor = requireAuth(request);
      return sendResult(reply, request, await notificationService.markRead(editor, request.body));
    }
  );
}
