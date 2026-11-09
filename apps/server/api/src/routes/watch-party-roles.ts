import {
  applyWatchPartyPreset,
  assignWatchPartyRole,
  createWatchPartyRole,
  deleteWatchPartyRole,
  listWatchPartyRoles,
  revokeWatchPartyRole,
  updateWatchPartyRole,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { partyCallerOf } from './party-caller';
import { sendResult } from './send-result';

export async function watchPartyRolesRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyRoleService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listWatchPartyRoles.path,
    { schema: { ...contractSchema(listWatchPartyRoles), params: listWatchPartyRoles.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyRoleService.list(request.params.id, partyCallerOf(request))
      )
  );

  server.post(
    createWatchPartyRole.path,
    {
      schema: {
        ...contractSchema(createWatchPartyRole),
        params: createWatchPartyRole.params,
        body: createWatchPartyRole.body,
      },
    },
    async (request, reply) => {
      requireAuth(request);
      return sendResult(
        reply,
        request,
        await watchPartyRoleService.create(request.params.id, partyCallerOf(request), request.body),
        { status: createWatchPartyRole.status }
      );
    }
  );

  server.patch(
    updateWatchPartyRole.path,
    {
      schema: {
        ...contractSchema(updateWatchPartyRole),
        params: updateWatchPartyRole.params,
        body: updateWatchPartyRole.body,
      },
    },
    async (request, reply) => {
      requireAuth(request);
      const { id, roleId } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyRoleService.update(id, partyCallerOf(request), roleId, request.body)
      );
    }
  );

  server.delete(
    deleteWatchPartyRole.path,
    { schema: { ...contractSchema(deleteWatchPartyRole), params: deleteWatchPartyRole.params } },
    async (request, reply) => {
      requireAuth(request);
      const { id, roleId } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyRoleService.remove(id, partyCallerOf(request), roleId),
        { status: deleteWatchPartyRole.status }
      );
    }
  );

  server.post(
    applyWatchPartyPreset.path,
    {
      schema: {
        ...contractSchema(applyWatchPartyPreset),
        params: applyWatchPartyPreset.params,
        body: applyWatchPartyPreset.body,
      },
    },
    async (request, reply) => {
      requireAuth(request);
      return sendResult(
        reply,
        request,
        await watchPartyRoleService.applyPreset(
          request.params.id,
          partyCallerOf(request),
          request.body
        )
      );
    }
  );

  server.put(
    assignWatchPartyRole.path,
    {
      schema: {
        ...contractSchema(assignWatchPartyRole),
        params: assignWatchPartyRole.params,
        body: assignWatchPartyRole.body,
      },
    },
    async (request, reply) => {
      requireAuth(request);
      const { id, memberKey, roleId } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyRoleService.assign(
          id,
          partyCallerOf(request),
          memberKey,
          roleId,
          request.body
        ),
        { status: assignWatchPartyRole.status }
      );
    }
  );

  server.delete(
    revokeWatchPartyRole.path,
    { schema: { ...contractSchema(revokeWatchPartyRole), params: revokeWatchPartyRole.params } },
    async (request, reply) => {
      requireAuth(request);
      const { id, memberKey, roleId } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyRoleService.revoke(id, partyCallerOf(request), memberKey, roleId),
        { status: revokeWatchPartyRole.status }
      );
    }
  );
}
