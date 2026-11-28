import {
  SMART_PLAYLIST_FORMATS,
  SMART_PLAYLIST_MATCHES,
  SMART_PLAYLIST_MAX_CHANNELS,
  SMART_PLAYLIST_MAX_CONDITIONS,
  SMART_PLAYLIST_MAX_LIMIT,
  SMART_PLAYLIST_MAX_TAGS,
  SMART_PLAYLIST_SORTS,
  type SmartPlaylistRules,
} from '@vp/domain';
import { z } from 'zod';

const MAX_DURATION_SECONDS = 24 * 60 * 60;
const MAX_NEWER_THAN_DAYS = 3650;
const MAX_TAG_LENGTH = 50;

const SecondsSchema = z.number().int().nonnegative().max(MAX_DURATION_SECONDS);

const DurationSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('under'), seconds: SecondsSchema.positive() }),
  z.strictObject({ op: z.literal('over'), seconds: SecondsSchema }),
  z
    .strictObject({
      op: z.literal('between'),
      minSeconds: SecondsSchema,
      maxSeconds: SecondsSchema,
    })
    .refine(({ minSeconds, maxSeconds }) => minSeconds < maxSeconds, {
      error: 'minSeconds is below maxSeconds',
      path: ['maxSeconds'],
    }),
]);

const ConditionSchema = z.discriminatedUnion('field', [
  z.strictObject({
    field: z.literal('channel'),
    channelIds: z.array(z.uuid()).min(1).max(SMART_PLAYLIST_MAX_CHANNELS),
  }),
  z.strictObject({
    field: z.literal('tag'),
    tags: z
      .array(z.string().trim().toLowerCase().min(1).max(MAX_TAG_LENGTH))
      .min(1)
      .max(SMART_PLAYLIST_MAX_TAGS)
      .describe('A video matches when it carries any of them'),
  }),
  z.strictObject({ field: z.literal('category'), categoryId: z.uuid() }),
  z.strictObject({ field: z.literal('duration'), duration: DurationSchema }),
  z.strictObject({
    field: z.literal('format'),
    format: z.enum(SMART_PLAYLIST_FORMATS).describe('long: a standard video; short: a Short'),
  }),
  z.strictObject({
    field: z.literal('newer_than'),
    days: z.number().int().positive().max(MAX_NEWER_THAN_DAYS),
  }),
  z.strictObject({
    field: z.literal('unwatched'),
  }),
]);

/**
 * What a smart playlist holds, computed on every read over the public feed: a tagged union on
 * `field`, so a condition carries exactly its own operands. 121 reuses it as a section source.
 */
export const PlaylistRulesSchema = z
  .strictObject({
    match: z.enum(SMART_PLAYLIST_MATCHES).describe('all: every condition; any: at least one'),
    conditions: z
      .array(ConditionSchema)
      .max(SMART_PLAYLIST_MAX_CONDITIONS)
      .describe(
        'unwatched is this viewer below 92 percent of the video; it matches everything for a guest'
      ),
    sort: z.enum(SMART_PLAYLIST_SORTS),
    limit: z.number().int().positive().max(SMART_PLAYLIST_MAX_LIMIT),
  })
  .describe(
    `Up to ${SMART_PLAYLIST_MAX_CONDITIONS} conditions and ${SMART_PLAYLIST_MAX_LIMIT} videos`
  ) satisfies z.ZodType<SmartPlaylistRules>;
