export const CONTENT_REF_TYPES = [
  'video',
  'clip',
  'post',
  'thread',
  'playlist',
  'live',
  'episode',
] as const;

export type ContentRefType = (typeof CONTENT_REF_TYPES)[number];

/** A Short is a `video` whose `format` is `short`; it is never a kind of its own. */
export type ContentRef =
  | { type: 'video'; id: string }
  | { type: 'clip'; id: string }
  | { type: 'post'; id: string }
  | { type: 'thread'; id: string }
  | { type: 'playlist'; id: string }
  | { type: 'live'; id: string }
  | { type: 'episode'; playlistId: string; videoId: string };

/** The columns a reference is stored in: `type`, `id` and the episode's playlist as the auxiliary id. */
export interface StoredContentRef {
  type: ContentRefType;
  id: string;
  auxId: string | null;
}

export function toStoredRef(ref: ContentRef): StoredContentRef {
  switch (ref.type) {
    case 'episode':
      return { type: 'episode', id: ref.videoId, auxId: ref.playlistId };
    case 'video':
    case 'clip':
    case 'post':
    case 'thread':
    case 'playlist':
    case 'live':
      return { type: ref.type, id: ref.id, auxId: null };
  }
}

export function fromStoredRef({ type, id, auxId }: StoredContentRef): ContentRef {
  switch (type) {
    case 'episode':
      return { type, playlistId: auxId ?? '', videoId: id };
    case 'video':
    case 'clip':
    case 'post':
    case 'thread':
    case 'playlist':
    case 'live':
      return { type, id };
  }
}

export function contentRefKey(ref: ContentRef): string {
  const { type, id, auxId } = toStoredRef(ref);
  return auxId === null ? `${type}:${id}` : `${type}:${auxId}:${id}`;
}

export function sameContentRef(a: ContentRef, b: ContentRef): boolean {
  return contentRefKey(a) === contentRefKey(b);
}

/** Kinds with a playhead, so the only ones that take an anchor. */
export const TIMELINE_REF_TYPES = [
  'video',
  'clip',
  'live',
  'episode',
] as const satisfies readonly ContentRefType[];

export function hasTimeline(type: ContentRefType): boolean {
  return (TIMELINE_REF_TYPES as readonly ContentRefType[]).includes(type);
}

export const CONTENT_LINK_RELATIONS = [
  'full_video',
  'clip_of',
  'part_of',
  'previous',
  'follow_up',
  'recap',
  'extended_cut',
  'behind_the_scenes',
  'translation',
  'corrects',
  'response_to',
  'reaction_to',
  'remix_of',
  'discussion',
  'related',
] as const;

export type ContentLinkRelation = (typeof CONTENT_LINK_RELATIONS)[number];

/** `clip_of` is read from the `clips` table and never stored. */
export type StoredLinkRelation = Exclude<ContentLinkRelation, 'clip_of'>;

export type ContentLinkParams =
  | { relation: 'part_of'; part: number | null }
  | { relation: 'translation'; locale: string }
  | { relation: Exclude<StoredLinkRelation, 'part_of' | 'translation'> };

export interface RelationSpec {
  /** Message key of the label the target side shows, e.g. "Cut into n Shorts". */
  reverseLabel: string;
  sources: readonly ContentRefType[];
  targets: readonly ContentRefType[];
  acrossChannels: boolean;
  /** `previous`, `part_of` and `follow_up` chains may not loop. */
  chain: boolean;
  symmetric: boolean;
}

const PLAYABLE = ['video', 'clip', 'live', 'episode'] as const satisfies readonly ContentRefType[];
const ANY = CONTENT_REF_TYPES;
const SERIES = ['video', 'episode', 'playlist'] as const satisfies readonly ContentRefType[];

const spec = (
  reverseLabel: string,
  sources: readonly ContentRefType[],
  targets: readonly ContentRefType[],
  acrossChannels: boolean,
  extra: Partial<Pick<RelationSpec, 'chain' | 'symmetric'>> = {}
): RelationSpec => ({
  reverseLabel,
  sources,
  targets,
  acrossChannels,
  chain: extra.chain ?? false,
  symmetric: extra.symmetric ?? false,
});

/** The one table the rule, the API, the studio picker and the labels read. */
export const RELATIONS = {
  full_video: spec('links.reverse.fullVideo', ['video', 'clip'], ['video', 'episode'], false),
  clip_of: spec('links.reverse.clipOf', ['clip'], ['video'], false),
  part_of: spec('links.reverse.partOf', SERIES, SERIES, false, { chain: true }),
  previous: spec('links.reverse.previous', SERIES, SERIES, false, { chain: true }),
  follow_up: spec('links.reverse.followUp', PLAYABLE, PLAYABLE, false, { chain: true }),
  recap: spec('links.reverse.recap', PLAYABLE, ANY, false),
  extended_cut: spec('links.reverse.extendedCut', PLAYABLE, PLAYABLE, false),
  behind_the_scenes: spec('links.reverse.behindTheScenes', ANY, ANY, false),
  translation: spec('links.reverse.translation', PLAYABLE, PLAYABLE, false),
  corrects: spec('links.reverse.corrects', ANY, ANY, false),
  response_to: spec('links.reverse.responseTo', ANY, ANY, true),
  reaction_to: spec('links.reverse.reactionTo', PLAYABLE, ANY, true),
  remix_of: spec('links.reverse.remixOf', PLAYABLE, PLAYABLE, true),
  discussion: spec('links.reverse.discussion', ['post', 'thread'], ANY, true),
  related: spec('links.reverse.related', ANY, ANY, true, { symmetric: true }),
} as const satisfies Record<ContentLinkRelation, RelationSpec>;

export const CHAIN_RELATIONS = CONTENT_LINK_RELATIONS.filter(
  (relation) => RELATIONS[relation].chain
);

export const CONTENT_LINK_STATUSES = [
  'active',
  'pending',
  'declined',
  'suggested',
  'broken',
] as const;

export type ContentLinkStatus = (typeof CONTENT_LINK_STATUSES)[number];

/** A link a member wrote, or one a viewer suggested; it stays on the row after the suggestion is accepted. */
export const LINK_ORIGINS = ['creator', 'viewer'] as const;

export type LinkOrigin = (typeof LINK_ORIGINS)[number];

export const LINK_POLICIES = ['allow', 'approve', 'block'] as const;

export type LinkPolicy = (typeof LINK_POLICIES)[number];

export const DEFAULT_LINK_POLICY: LinkPolicy = 'approve';

export interface LinkAnchors {
  sourceStartMs: number | null;
  sourceEndMs: number | null;
  targetStartMs: number | null;
  targetEndMs: number | null;
}

export const NO_ANCHORS: LinkAnchors = {
  sourceStartMs: null,
  sourceEndMs: null,
  targetStartMs: null,
  targetEndMs: null,
};

export interface ContentLink {
  id: string;
  source: ContentRef;
  target: ContentRef;
  params: ContentLinkParams;
  anchors: LinkAnchors;
  status: ContentLinkStatus;
  sourceChannelId: string;
  targetChannelId: string;
  origin: LinkOrigin;
  /** `null` once the author's account is deleted. */
  createdBy: string | null;
  decidedBy: string | null;
  createdAt: Date;
}

export const OUTGOING_LINKS_PER_ITEM = 20;
export const LINKS_PER_CHANNEL = 5000;
export const LINK_CHAIN_MAX_DEPTH = 50;
export const LINK_SUGGESTIONS_PER_DAY = 10;
export const BACKLINK_COUNT_DISPLAY_CAP = 99;
export const BACKLINK_SAMPLE_SIZE = 5;
export const CONTENT_LINK_CACHE_SECONDS = 60;
export const LINK_SUGGESTION_WINDOW = 200;

/** Clamp a stored anchor to the current duration, so a trimmed or replaced video never points past its end. */
export function clampAnchor(ms: number | null, durationMs: number | null): number | null {
  if (ms === null || durationMs === null) return ms;
  return Math.min(Math.max(0, ms), durationMs);
}

export function clampAnchors(
  anchors: LinkAnchors,
  sourceDurationMs: number | null,
  targetDurationMs: number | null
): LinkAnchors {
  return {
    sourceStartMs: clampAnchor(anchors.sourceStartMs, sourceDurationMs),
    sourceEndMs: clampAnchor(anchors.sourceEndMs, sourceDurationMs),
    targetStartMs: clampAnchor(anchors.targetStartMs, targetDurationMs),
    targetEndMs: clampAnchor(anchors.targetEndMs, targetDurationMs),
  };
}
