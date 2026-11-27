import { ENTITY_REVISION_KEEP } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { CursorSchema, OptionalPageLimitSchema } from './pagination';
import { ManagedPostSchema, PostIdParamSchema, PostPayloadSchema } from './post-schemas';

const WHO =
  'Owner, manager and editor of the channel the request acts on; a moderator and an analyst are refused.';

const PostRevisionSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().nonnegative().describe('The post version this state belongs to'),
    payload: PostPayloadSchema,
    authorUserId: z
      .uuid()
      .nullable()
      .describe('Who saved it; null for the state before the first edit'),
    restoredFromVersion: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('The version a restore went back to; null for an ordinary edit'),
    createdAt: z.string().describe('ISO 8601 timestamp'),
  })
  .meta({ id: 'PostRevision', description: 'One saved state of a published post' });

const PostRevisionPageSchema = z.object({
  items: z.array(PostRevisionSchema),
  nextCursor: z.string().nullable(),
});

const ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
} as const;

export const listPostRevisions = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/posts/:id/revisions',
  scope: 'posts:write',
  channelScoped: true,
  tag: 'Posts',
  summary: 'List the edit history of a post',
  description: `Newest first, keyset-paginated on the version. Every edit of a published post is one entry, and the last ${ENTITY_REVISION_KEEP} are kept. ${WHO}`,
  params: PostIdParamSchema,
  query: z.object({ cursor: CursorSchema.optional(), limit: OptionalPageLimitSchema }),
  status: 200,
  result: PostRevisionPageSchema,
  errors: {
    ...ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    404: [ErrorCodes.POST_NOT_FOUND],
  },
});

export const restorePostRevision = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/posts/:id/revisions/:revisionId/restore',
  scope: 'posts:write',
  channelScoped: true,
  tag: 'Posts',
  summary: 'Restore an earlier state of a post',
  description: `A normal edit under the current version, so a stale version answers 409 VERSION_CONFLICT; it appends a new revision rather than rewriting history. A poll that has votes cannot be restored to different options (409 POST_POLL_LOCKED). ${WHO}`,
  params: PostIdParamSchema.extend({ revisionId: z.uuid() }),
  body: z.object({
    version: z.number().int().positive().describe('The post version the restore was made against'),
  }),
  status: 200,
  result: ManagedPostSchema,
  errors: {
    ...ERRORS,
    404: [ErrorCodes.POST_NOT_FOUND, ErrorCodes.REVISION_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT, ErrorCodes.POST_POLL_LOCKED],
    422: [
      ErrorCodes.VALIDATION_FAILED,
      ErrorCodes.POST_SHARE_NOT_PUBLIC,
      ErrorCodes.POST_IMAGE_NOT_READY,
    ],
  },
});

export type PostRevisionView = z.infer<typeof PostRevisionSchema>;
export type PostRevisionPageView = z.infer<typeof PostRevisionPageSchema>;
