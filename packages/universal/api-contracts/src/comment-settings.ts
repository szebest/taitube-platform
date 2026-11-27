import { DISCLOSURE_RULES, DISCLOSURES, REVIEW_MODES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

const DisclosureSchema = z.enum(DISCLOSURES);

const CommentSettingsSchema = z.object({
  reviewMode: z.enum(REVIEW_MODES).describe('none, hold comments with a link, or hold everything'),
  blockedWords: z
    .array(z.string())
    .describe('Up to 200 entries of 2 to 40 characters; a match holds the comment'),
  linkAllowlist: z
    .array(z.string())
    .describe('Up to 50 host names whose links, and their subdomains, are not held'),
  slowModeSeconds: z
    .number()
    .int()
    .nullable()
    .describe('null for no limit, otherwise one of 5, 10, 30, 60 or 300'),
  subscribersOnly: z.boolean(),
  minAccountAgeDays: z.number().int().describe('0 to 30'),
  disclosure: z
    .object(
      Object.fromEntries(DISCLOSURE_RULES.map((rule) => [rule, DisclosureSchema])) as Record<
        (typeof DISCLOSURE_RULES)[number],
        typeof DisclosureSchema
      >
    )
    .describe('What the author is told by default for each action and each automatic hold'),
});

const TAG = 'Comment moderation';

const SETTINGS_ERRORS = {
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
} as const;

export const getCommentSettings = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/comment-settings',
  channelScoped: true,
  tag: TAG,
  summary: 'Read the comment settings of the channel',
  description:
    'The acting channel comment settings; a channel that never saved any has the defaults. Owner and managers.',
  status: 200,
  result: CommentSettingsSchema,
  errors: SETTINGS_ERRORS,
});

export const updateCommentSettings = defineEndpoint({
  method: 'PUT',
  path: '/v1/me/channel/comment-settings',
  channelScoped: true,
  tag: TAG,
  summary: 'Replace the comment settings of the channel',
  description:
    'Replaces the whole document and records settings.comments.updated in the channel audit log with the fields that changed. Owner and managers; a moderator or an editor is refused.',
  body: CommentSettingsSchema,
  status: 200,
  result: CommentSettingsSchema,
  errors: {
    ...SETTINGS_ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export type CommentSettingsView = z.infer<typeof CommentSettingsSchema>;
