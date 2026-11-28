import type { SmartPlaylistRules } from '@vp/domain';
import { uuid } from '#app/__tests__/library-fixtures';
import {
  type ConditionDraft,
  type ConditionField,
  draftCondition,
  draftToRules,
  EMPTY_RULES,
  minutesFor,
  type RulesDraft,
  rulesToDraft,
  validateRulesDraft,
} from '../rules-form';

const CHANNEL_A = uuid(7001);
const CHANNEL_B = uuid(7002);
const CATEGORY = uuid(6001);

type Operands = ConditionDraft extends infer C
  ? C extends ConditionDraft
    ? Omit<C, 'key'>
    : never
  : never;

const draftOf = (conditions: Operands[]): RulesDraft => ({
  ...EMPTY_RULES,
  conditions: conditions.map((condition, at) => ({ ...condition, key: `row-${at}` })),
});

const RULES: SmartPlaylistRules = {
  match: 'all',
  conditions: [
    { field: 'channel', channelIds: [CHANNEL_A, CHANNEL_B] },
    { field: 'tag', tags: ['lisbon'] },
    { field: 'category', categoryId: CATEGORY },
    { field: 'duration', duration: { op: 'under', seconds: 600 } },
    { field: 'duration', duration: { op: 'between', minSeconds: 120, maxSeconds: 1800 } },
    { field: 'format', format: 'short' },
    { field: 'newer_than', days: 30 },
    { field: 'unwatched' },
  ],
  sort: 'popular',
  limit: 120,
};

describe('apps/client/web: the rules form', () => {
  it('sends channel A or B, under 10 minutes, unwatched, newer than 30 days as the API reads it', () => {
    const draft = draftOf([
      {
        field: 'channel',
        channels: [
          { id: CHANNEL_A, displayName: 'A' },
          { id: CHANNEL_B, displayName: 'B' },
        ],
      },
      { field: 'duration', op: 'under', minutes: [10] },
      { field: 'unwatched' },
      { field: 'newer_than', days: 30 },
    ]);

    expect(draftToRules(draft)).toEqual({
      match: 'all',
      conditions: [
        { field: 'channel', channelIds: [CHANNEL_A, CHANNEL_B] },
        { field: 'duration', duration: { op: 'under', seconds: 600 } },
        { field: 'unwatched' },
        { field: 'newer_than', days: 30 },
      ],
      sort: 'newest',
      limit: 50,
    });
  });

  it('reads saved rules back into the form and sends them unchanged', () => {
    expect(draftToRules(rulesToDraft(RULES))).toEqual(RULES);
  });

  it('starts a new smart playlist from the defaults, and gives each row its own key', () => {
    const [first, second] = rulesToDraft(RULES).conditions;

    expect(rulesToDraft(null)).toEqual(EMPTY_RULES);
    expect(first?.key).not.toBe(second?.key);
  });

  it.each<[ConditionField, Operands]>([
    ['channel', { field: 'channel', channels: [] }],
    ['tag', { field: 'tag', tags: [] }],
    ['category', { field: 'category', categoryId: null }],
    ['duration', { field: 'duration', op: 'under', minutes: [10] }],
    ['format', { field: 'format', format: 'long' }],
    ['newer_than', { field: 'newer_than', days: 30 }],
    ['unwatched', { field: 'unwatched' }],
  ])('starts a %s condition with its usual operands', (field, operands) => {
    expect(draftCondition(field)).toEqual({ ...operands, key: expect.any(String) });
  });

  it.each([
    { op: 'between' as const, minutes: [12], expected: [12, 30] },
    { op: 'between' as const, minutes: [40, 20], expected: [40, 41] },
    { op: 'under' as const, minutes: [12, 30], expected: [12] },
    { op: 'over' as const, minutes: [], expected: [10] },
  ])(
    'keeps $expected minutes when a duration of $minutes turns $op',
    ({ op, minutes, expected }) => {
      expect(minutesFor(op, minutes)).toEqual(expected);
    }
  );

  it.each([
    { name: 'no conditions', draft: draftOf([]), valid: true },
    {
      name: 'a channel condition with no channel',
      draft: draftOf([{ field: 'channel', channels: [] }]),
      valid: false,
    },
    {
      name: 'a category not picked yet',
      draft: draftOf([{ field: 'category', categoryId: null }]),
      valid: false,
    },
    {
      name: 'a range that ends where it starts',
      draft: draftOf([{ field: 'duration', op: 'between', minutes: [10, 10] }]),
      valid: false,
    },
  ])('lets the form send $name: $valid', ({ draft, valid }) => {
    expect(validateRulesDraft({ value: draft }) === undefined).toBe(valid);
  });
});
