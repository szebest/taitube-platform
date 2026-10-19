import {
  getPreferences,
  type PreferencesConflictError,
  problemFor,
  updatePreferences,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { toPreferencesView } from '../services/preferences-views';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function preferencesRoutes(app: FastifyInstance): Promise<void> {
  const { preferencesService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getPreferences.path,
    { schema: contractSchema(getPreferences) },
    async (request, reply) => {
      const viewer = requireAuth(request);
      return sendResult(reply, request, await preferencesService.get(viewer, viewer.id));
    }
  );

  server.patch(
    updatePreferences.path,
    { schema: { ...contractSchema(updatePreferences), body: updatePreferences.body } },
    async (request, reply) => {
      const editor = requireAuth(request);
      return sendResult(
        reply,
        request,
        await preferencesService.update(editor, editor.id, request.body),
        {
          on: {
            VERSION_CONFLICT: (failure) =>
              problemFor(failure, request.url, {
                errors: [
                  {
                    field: 'version',
                    current: toPreferencesView(failure.current),
                  } satisfies PreferencesConflictError,
                ],
              }),
          },
        }
      );
    }
  );
}
