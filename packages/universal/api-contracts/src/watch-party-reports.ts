import {
  WATCH_PARTY_REPORT_CONTEXTS,
  WATCH_PARTY_REPORT_REASONS,
  type WatchPartyReportContext,
  type WatchPartyReportReason,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { MemberKeySchema, WatchPartyIdParamSchema, WatchPartySchema } from './watch-party-resource';

const REPORT_DETAILS_MAX = 500;
const MODERATION_REASON_MAX = 200;

export const reportWatchParty = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/reports',
  tag: 'Watch parties',
  summary: 'Report a party or one of its members',
  description:
    'One report per account per room, or per member with targetKey. Three open room reports from distinct accounts hide the room from discovery until a moderator restores it.',
  params: WatchPartyIdParamSchema,
  body: z.object({
    targetKey: MemberKeySchema.optional().describe(
      'A member of the room; the room itself without it'
    ),
    context: z
      .enum(
        WATCH_PARTY_REPORT_CONTEXTS as readonly [
          WatchPartyReportContext,
          ...WatchPartyReportContext[],
        ]
      )
      .default('room'),
    reason: z.enum(
      WATCH_PARTY_REPORT_REASONS as readonly [WatchPartyReportReason, ...WatchPartyReportReason[]]
    ),
    details: z.string().trim().min(1).max(REPORT_DETAILS_MAX).optional(),
  }),
  status: 201,
  result: z.object({ id: z.uuid() }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    409: [ErrorCodes.WATCH_PARTY_ALREADY_REPORTED],
  },
});

const ModerationBodySchema = z.object({
  reason: z.string().trim().min(1).max(MODERATION_REASON_MAX),
});

export const adminCloseWatchParty = defineEndpoint({
  method: 'POST',
  path: '/v1/admin/watch-parties/:id/close',
  tag: 'Watch parties',
  summary: 'Close a watch party as a moderator',
  description: 'Ends the room for everyone, whatever its owner or roles say (MODERATOR, ADMIN).',
  params: WatchPartyIdParamSchema,
  body: ModerationBodySchema,
  status: 200,
  result: WatchPartySchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    410: [ErrorCodes.WATCH_PARTY_CLOSED],
  },
});

export const adminRestoreWatchParty = defineEndpoint({
  method: 'POST',
  path: '/v1/admin/watch-parties/:id/restore',
  tag: 'Watch parties',
  summary: 'Restore a reported watch party',
  description:
    'Lifts the auto-hide the reports caused and resolves the room reports, so discovery lists the room again (MODERATOR, ADMIN).',
  params: WatchPartyIdParamSchema,
  body: ModerationBodySchema,
  status: 200,
  result: WatchPartySchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export type ReportWatchPartyBody = z.infer<typeof reportWatchParty.body>;
