import {
  AccountSchema,
  CaptionListSchema,
  CommentPageSchema,
  CreatorLibrarySchema,
  IdSchema,
  OwnedPlaylistsSchema,
  PlaylistSchema,
  PreparedImageSchema,
  SearchesPageSchema,
  SubscriptionStateSchema,
  VideoDetailSchema,
  AnySchema,
} from '../responses';

const comment = {
  id: 'c1',
  parentId: null,
  content: 'hi',
  isPinned: false,
  heartedByCreator: false,
  replyCount: 0,
};

const video = { id: 'v1', status: 'READY', visibility: 'public', format: 'standard' };

describe('seed/responses', () => {
  it.each([
    {
      name: 'a library with a null title and no cursor',
      schema: CreatorLibrarySchema,
      body: { items: [{ ...video, title: null }], nextCursor: null },
    },
    {
      name: 'a video detail',
      schema: VideoDetailSchema,
      body: { ...video, version: 2, playbackUrl: 'http://cdn/x.m3u8' },
    },
    {
      name: 'a comment page whose author is absent',
      schema: CommentPageSchema,
      body: { items: [comment], nextCursor: null },
    },
    { name: 'an id', schema: IdSchema, body: { id: 'x', extra: true } },
    {
      name: 'owned playlists',
      schema: OwnedPlaylistsSchema,
      body: { items: [{ id: 'p', title: 'Later', isSystem: true }] },
    },
    { name: 'a playlist', schema: PlaylistSchema, body: { id: 'p', items: [{ videoId: 'v' }] } },
    { name: 'a subscription state', schema: SubscriptionStateSchema, body: { subscribed: true } },
    {
      name: 'searches',
      schema: SearchesPageSchema,
      body: { items: [{ id: 'a', query: 'cats' }], nextCursor: null },
    },
    { name: 'captions', schema: CaptionListSchema, body: { tracks: [{ language: null }, {}] } },
    {
      name: 'a prepared image upload',
      schema: PreparedImageSchema,
      body: { uploadId: 'u', uploadUrl: 'http://s', headers: { a: 'b' } },
    },
    {
      name: 'an account',
      schema: AccountSchema,
      body: { id: 'u', role: 'user', channel: { id: 'c', handle: 'h', displayName: 'D' } },
    },
    { name: 'anything', schema: AnySchema, body: 42 },
  ])('accepts $name', ({ schema, body }) => {
    expect(schema.safeParse(body).success).toBe(true);
  });

  it.each([
    { name: 'a library without items', schema: CreatorLibrarySchema, body: { nextCursor: null } },
    { name: 'a detail without a version', schema: VideoDetailSchema, body: video },
    {
      name: 'a comment with a numeric reply flag',
      schema: CommentPageSchema,
      body: { items: [{ ...comment, replyCount: 'many' }], nextCursor: null },
    },
    { name: 'a numeric id', schema: IdSchema, body: { id: 1 } },
    {
      name: 'a subscription state as text',
      schema: SubscriptionStateSchema,
      body: { subscribed: 'yes' },
    },
    {
      name: 'a prepared image without headers',
      schema: PreparedImageSchema,
      body: { uploadId: 'u', uploadUrl: 'http://s' },
    },
  ])('rejects $name', ({ schema, body }) => {
    expect(schema.safeParse(body).success).toBe(false);
  });
});
