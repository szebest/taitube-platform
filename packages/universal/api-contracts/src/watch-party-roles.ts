import { ROLE_EXPIRIES, ROLE_KINDS, WATCH_PARTY_PRESETS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { ROLE_NAME_BOUNDS } from '@vp/validation';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import {
  AccentSchema,
  MemberKeySchema,
  WatchPartyIdParamSchema,
  WatchPartyPermissionSchema,
  WatchPartyRoleSchema,
} from './watch-party-resource';

const RoleParamsSchema = WatchPartyIdParamSchema.extend({
  roleId: z.uuid({ error: 'Invalid role ID format' }),
});

const MemberRoleParamsSchema = RoleParamsSchema.extend({ memberKey: MemberKeySchema });

const RoleNameSchema = z.string().max(ROLE_NAME_BOUNDS.maxLength * 4);
const PositionSchema = z.number().int().describe('A free slot from 2 to 999, below your own role');

const RoleListSchema = z.object({
  items: z.array(WatchPartyRoleSchema).describe('By position, highest first'),
  rolesVersion: z.number().int(),
  permissionsVersion: z.number().int(),
});

/** Every refusal the hierarchy gives, with the permission a role change needs. */
const ROLE_REFUSALS = [
  ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
  ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
  ErrorCodes.WATCH_PARTY_ROLE_PROTECTED,
] as const;

export const listWatchPartyRoles = defineEndpoint({
  method: 'GET',
  path: '/v1/watch-parties/:id/roles',
  tag: 'Watch parties',
  summary: 'List the roles',
  description: 'Every role of the room with its permissions and holders, for members.',
  partyGuest: true,
  params: WatchPartyIdParamSchema,
  status: 200,
  result: RoleListSchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED, ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const createWatchPartyRole = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/roles',
  tag: 'Watch parties',
  summary: 'Create a role',
  description:
    'A custom role below your own (roles.manage), holding only permissions you hold. At most 14 custom roles.',
  params: WatchPartyIdParamSchema,
  body: z.object({
    name: RoleNameSchema,
    colour: AccentSchema.nullable().optional(),
    kind: z.enum(ROLE_KINDS).default('grant'),
    position: PositionSchema.optional(),
    permissions: z.array(WatchPartyPermissionSchema),
  }),
  status: 201,
  result: WatchPartyRoleSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: ROLE_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    409: [ErrorCodes.WATCH_PARTY_ROLE_LIMIT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const updateWatchPartyRole = defineEndpoint({
  method: 'PATCH',
  path: '/v1/watch-parties/:id/roles/:roleId',
  tag: 'Watch parties',
  summary: 'Edit a role',
  description:
    "Renames, recolours, moves or changes a role's permissions, guarded by its updatedAt. Owner's name and colour are the owner's alone; Guest never passes its ceiling.",
  params: RoleParamsSchema,
  body: z.object({
    name: RoleNameSchema.optional(),
    colour: AccentSchema.nullable().optional(),
    position: PositionSchema.optional(),
    permissions: z.array(WatchPartyPermissionSchema).optional(),
    updatedAt: z.iso.datetime(),
  }),
  status: 200,
  result: WatchPartyRoleSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: ROLE_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND, ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const deleteWatchPartyRole = defineEndpoint({
  method: 'DELETE',
  path: '/v1/watch-parties/:id/roles/:roleId',
  tag: 'Watch parties',
  summary: 'Delete a role',
  description:
    'A custom role below your own (roles.manage); its holders lose it. Built-in roles stay.',
  params: RoleParamsSchema,
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: ROLE_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND, ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND],
  },
});

export const applyWatchPartyPreset = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/roles/preset',
  tag: 'Watch parties',
  summary: 'Apply a preset',
  description:
    'Resets every built-in role but Owner to the preset (roles.manage). Custom roles and assignments stay.',
  params: WatchPartyIdParamSchema,
  body: z.object({ preset: z.enum(WATCH_PARTY_PRESETS) }),
  status: 200,
  result: RoleListSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const assignWatchPartyRole = defineEndpoint({
  method: 'PUT',
  path: '/v1/watch-parties/:id/members/:memberKey/roles/:roleId',
  tag: 'Watch parties',
  summary: 'Assign a role',
  description:
    'Gives a member below you a role below you (roles.assign; chat.moderate for Chat muted, voice.moderate for Voice muted). expiresIn is for the mutes only.',
  params: MemberRoleParamsSchema,
  body: z.object({ expiresIn: z.enum(ROLE_EXPIRIES).optional() }).optional(),
  status: 204,
  result: z.null(),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: ROLE_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND, ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND],
  },
});

export const revokeWatchPartyRole = defineEndpoint({
  method: 'DELETE',
  path: '/v1/watch-parties/:id/members/:memberKey/roles/:roleId',
  tag: 'Watch parties',
  summary: 'Revoke a role',
  description:
    'Takes a role back under the same rules; anyone may drop a grant role they hold, never their own mute.',
  params: MemberRoleParamsSchema,
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: ROLE_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND, ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND],
  },
});

export type WatchPartyRoleList = z.infer<typeof RoleListSchema>;
