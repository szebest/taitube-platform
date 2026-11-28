import { PlaylistRulesSchema } from '../playlist-rules';

const CHANNEL = '00000000-0000-7000-8000-00000000c001';

const rules = (conditions: unknown[], extra: object = {}) => ({
  match: 'all',
  conditions,
  sort: 'newest',
  limit: 50,
  ...extra,
});

describe('packages/api-contracts: PlaylistRulesSchema', () => {
  it.each([
    { scenario: 'no conditions', body: rules([]), valid: true },
    {
      scenario: 'a channel',
      body: rules([{ field: 'channel', channelIds: [CHANNEL] }]),
      valid: true,
    },
    { scenario: 'no channel', body: rules([{ field: 'channel', channelIds: [] }]), valid: false },
    {
      scenario: '21 channels',
      body: rules([{ field: 'channel', channelIds: Array(21).fill(CHANNEL) }]),
      valid: false,
    },
    {
      scenario: '5 tags',
      body: rules([{ field: 'tag', tags: ['a', 'b', 'c', 'd', 'e'] }]),
      valid: true,
    },
    {
      scenario: '6 tags',
      body: rules([{ field: 'tag', tags: ['a', 'b', 'c', 'd', 'e', 'f'] }]),
      valid: false,
    },
    {
      scenario: 'a category',
      body: rules([{ field: 'category', categoryId: CHANNEL }]),
      valid: true,
    },
    {
      scenario: 'under 10 minutes',
      body: rules([{ field: 'duration', duration: { op: 'under', seconds: 600 } }]),
      valid: true,
    },
    {
      scenario: 'a range',
      body: rules([
        { field: 'duration', duration: { op: 'between', minSeconds: 60, maxSeconds: 600 } },
      ]),
      valid: true,
    },
    {
      scenario: 'a range upside down',
      body: rules([
        { field: 'duration', duration: { op: 'between', minSeconds: 600, maxSeconds: 60 } },
      ]),
      valid: false,
    },
    {
      scenario: 'an operand of another operator',
      body: rules([{ field: 'duration', duration: { op: 'under', minSeconds: 60 } }]),
      valid: false,
    },
    { scenario: 'a Short', body: rules([{ field: 'format', format: 'short' }]), valid: true },
    {
      scenario: 'a format of its own',
      body: rules([{ field: 'format', format: 'standard' }]),
      valid: false,
    },
    {
      scenario: 'newer than 30 days',
      body: rules([{ field: 'newer_than', days: 30 }]),
      valid: true,
    },
    { scenario: 'unwatched', body: rules([{ field: 'unwatched' }]), valid: true },
    {
      scenario: 'an operand on unwatched',
      body: rules([{ field: 'unwatched', percent: 50 }]),
      valid: false,
    },
    {
      scenario: 'a field it does not know',
      body: rules([{ field: 'title', q: 'x' }]),
      valid: false,
    },
    { scenario: '9 conditions', body: rules(Array(9).fill({ field: 'unwatched' })), valid: false },
    { scenario: 'a limit of 200', body: rules([], { limit: 200 }), valid: true },
    { scenario: 'a limit of 201', body: rules([], { limit: 201 }), valid: false },
    { scenario: 'an unknown sort', body: rules([], { sort: 'random' }), valid: false },
  ])('takes $scenario: $valid', ({ body, valid }) => {
    expect(PlaylistRulesSchema.safeParse(body).success).toBe(valid);
  });

  it('lowercases and trims the tags it matches', () => {
    const parsed = PlaylistRulesSchema.parse(rules([{ field: 'tag', tags: [' Jazz '] }]));

    expect(parsed.conditions).toEqual([{ field: 'tag', tags: ['jazz'] }]);
  });
});
