import {
  PLAYLIST_COVER_MODES,
  PLAYLIST_COVER_MOSAIC_SIZE,
  PLAYLIST_KINDS,
  PLAYLIST_VISIBILITIES,
} from '@vp/domain';
import { z } from 'zod';
import { ChannelCardSchema } from './channels';
import { PlaylistRulesSchema } from './playlist-rules';
import { SHARE_TOKEN_PARAM, ShareTokenSchema } from './video-access';
import { VideoSummarySchema } from './video-resource';

export const ShareQuerySchema = z.object({
  [SHARE_TOKEN_PARAM]: ShareTokenSchema.optional().describe(
    'A share link token of this playlist, which lets its holder read it whatever its visibility'
  ),
});

export const PlaylistVisibilitySchema = z
  .enum(PLAYLIST_VISIBILITIES)
  .describe('public: listed and searchable; unlisted: anyone with the link; private: the owner');

export const PlaylistKindSchema = z
  .enum(PLAYLIST_KINDS)
  .describe('series: made only of the owner channel videos, with episodes and progress');

const PlaylistItemAdderSchema = z.object({
  userId: z.uuid(),
  channel: ChannelCardSchema.nullable().describe("The adder's primary channel, as their avatar"),
});

export const PlaylistItemSchema = z.object({
  id: z.uuid().describe('The item id a reorder names'),
  videoId: z.uuid(),
  position: z
    .number()
    .int()
    .nonnegative()
    .describe('0-based place in the playlist; a video hidden from this viewer keeps its place'),
  addedAt: z.string().describe('ISO 8601 timestamp the video was added'),
  episode: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe('Its place counted from 1, in a series; null in any other playlist'),
  progress: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      'Percent of the video this signed-in viewer has watched, in a series; null otherwise'
    ),
  addedBy: PlaylistItemAdderSchema.nullable().describe(
    'Who added it; null once their account is gone'
  ),
  note: z.string().nullable().describe('Up to 300 characters'),
  startMs: z.number().int().nonnegative().nullable().describe('Where the item starts playing'),
  endMs: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe('Where the item stops; null plays to the end. Clamped to the video as it is now'),
  video: VideoSummarySchema,
  channel: ChannelCardSchema.nullable(),
});

const PlaylistCoverSchema = z.object({
  mode: z
    .enum(PLAYLIST_COVER_MODES)
    .describe('auto: a mosaic of the first videos; item: one video it holds; custom: an image'),
  videoId: z.uuid().nullable().describe('The video an item cover shows'),
  mosaicUrls: z
    .array(z.string())
    .max(PLAYLIST_COVER_MOSAIC_SIZE)
    .describe('The first thumbnails this viewer may watch, for the auto mosaic; nothing is stored'),
});

const PlaylistSectionSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  position: z
    .number()
    .int()
    .nonnegative()
    .describe('Its place among the items and sections; never counted as a video'),
});

export const PlaylistSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  title: z.string(),
  description: z.string(),
  visibility: PlaylistVisibilitySchema,
  kind: PlaylistKindSchema,
  isSystem: z.boolean().describe('Watch Later: cannot be renamed or deleted'),
  thumbnailUrl: z
    .string()
    .nullable()
    .describe('The cover the mode picks: the custom image, the item video, else the first poster'),
  cover: PlaylistCoverSchema,
  rules: PlaylistRulesSchema.nullable().describe(
    'Set on a smart playlist, whose items are computed on every read and never stored'
  ),
  autoRemoveWatched: z
    .boolean()
    .describe('A video the owner finishes leaves the list; only while nobody else works on it'),
  pinnedAt: z.string().nullable().describe('ISO 8601; set while pinned as a library shelf'),
  forkedFromPlaylistId: z
    .uuid()
    .nullable()
    .describe('The playlist this one was forked from, as attribution; null once that one is gone'),
  videoCount: z.number().int().nonnegative().describe('Videos this viewer may watch'),
  owner: ChannelCardSchema.nullable(),
  nextEpisodeVideoId: z
    .uuid()
    .nullable()
    .describe(
      'A series, for a signed-in viewer: the first episode after the last one watched that is below 92 percent, else the first unfinished one; null otherwise or when all are done'
    ),
  items: z.array(PlaylistItemSchema),
  sections: z
    .array(PlaylistSectionSchema)
    .describe('Dividers between the items, in the same order'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 timestamp of the last change, items included'),
});

export const OwnedPlaylistSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  visibility: PlaylistVisibilitySchema,
  isSystem: z.boolean(),
  isSmart: z.boolean().describe('Computes its items from rules; nothing can be saved to it'),
  pinnedAt: z.string().nullable().describe('ISO 8601; the library shows it as a shelf while set'),
  videoCount: z.number().int().nonnegative(),
  containsVideo: z.boolean().describe('The playlist holds the videoId asked about'),
  updatedAt: z.string(),
});

export type PlaylistView = z.infer<typeof PlaylistSchema>;
export type OwnedPlaylistView = z.infer<typeof OwnedPlaylistSchema>;
