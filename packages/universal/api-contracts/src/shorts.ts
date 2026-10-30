import { ErrorCodes } from '@vp/errors';
import type { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { FeedResponseSchema } from './feed';
import { KeysetQuerySchema } from './pagination';

export const getShorts = defineEndpoint({
  method: 'GET',
  path: '/v1/shorts',
  tag: 'Feed',
  summary: 'Shorts feed',
  description:
    'The public ready Shorts for the swipe player, trending with a freshness boost. The cursor carries the Shorts already served, so a walk never repeats one. Anonymous access permitted.',
  anonymous: true,
  query: KeysetQuerySchema,
  status: 200,
  result: FeedResponseSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
  },
});

export type ShortsQuery = z.input<typeof getShorts.query>;
