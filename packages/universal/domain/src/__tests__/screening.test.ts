import {
  SCREENING_TRANSITIONS,
  creatorScreeningReasons,
  isScreeningCaseOpen,
  mergeFlag,
} from '../screening';
import type { ScreeningFinding } from '../screening';
import { VIDEO_STATUSES } from '../status-vocabulary';

describe('packages/domain: screening transitions', () => {
  it.each([
    { name: 'hold', from: 'PROCESSING', to: 'HELD' },
    { name: 'approve', from: 'HELD', to: 'PROCESSING' },
    { name: 'reject', from: 'HELD', to: 'REJECTED' },
    { name: 'appeal', from: 'REJECTED', to: 'HELD' },
  ] as const)('$name moves $from to $to', ({ name, from, to }) => {
    expect(SCREENING_TRANSITIONS[name]).toMatchObject({ from, to });
  });

  it('names every edge by an event of its own', () => {
    const events = Object.values(SCREENING_TRANSITIONS).map((edge) => edge.event);

    expect(new Set(events).size).toBe(events.length);
  });

  it.each(Object.entries(SCREENING_TRANSITIONS))(
    '%s starts and ends in a status the vocabulary declares',
    (_name, { from, to }) => {
      expect(VIDEO_STATUSES).toContain(from);
      expect(VIDEO_STATUSES).toContain(to);
    }
  );

  it.each([
    {
      name: 'an undecided hold',
      outcome: 'HOLD',
      decision: null,
      flags: 0,
      cleared: false,
      open: true,
    },
    {
      name: 'a decided hold',
      outcome: 'HOLD',
      decision: 'approved',
      flags: 0,
      cleared: true,
      open: false,
    },
    {
      name: 'a passed result with an unseen flag',
      outcome: 'PASS',
      decision: null,
      flags: 1,
      cleared: false,
      open: true,
    },
    {
      name: 'a passed result with a cleared flag',
      outcome: 'PASS',
      decision: 'dismissed',
      flags: 1,
      cleared: true,
      open: false,
    },
    {
      name: 'a decided hold flagged again',
      outcome: 'HOLD',
      decision: 'approved',
      flags: 1,
      cleared: false,
      open: true,
    },
    {
      name: 'a clean pass',
      outcome: 'PASS',
      decision: null,
      flags: 0,
      cleared: false,
      open: false,
    },
  ] as const)('reads $name as open: $open', ({ outcome, decision, flags, cleared, open }) => {
    const found = Array.from({ length: flags }, () => finding('PARTIAL_MATCH', { at: 1 }));

    expect(
      isScreeningCaseOpen({
        outcome,
        decision,
        flags: found,
        flagsClearedAt: cleared ? new Date() : null,
      })
    ).toBe(open);
  });

  it.each([
    {
      name: 'a first flag',
      before: [],
      next: finding('METADATA_SPAM', { a: 1 }),
      changed: true,
      reasons: ['METADATA_SPAM'],
    },
    {
      name: 'the same finding with its keys in another order',
      before: [finding('METADATA_SPAM', { a: 1, b: [1, 2] })],
      next: finding('METADATA_SPAM', { b: [1, 2], a: 1 }),
      changed: false,
      reasons: ['METADATA_SPAM'],
    },
    {
      name: 'a changed finding of the same reason',
      before: [finding('METADATA_SPAM', { a: 1 }), finding('PARTIAL_MATCH', {})],
      next: finding('METADATA_SPAM', { a: 2 }),
      changed: true,
      reasons: ['PARTIAL_MATCH', 'METADATA_SPAM'],
    },
    {
      name: 'the same reason read from a transcript, beside the one read from the text',
      before: [finding('METADATA_SPAM', { a: 1 })],
      next: finding('METADATA_SPAM', { source: 'transcript' }),
      changed: true,
      reasons: ['METADATA_SPAM', 'METADATA_SPAM'],
    },
  ])('merges $name: changed $changed', ({ before, next, changed, reasons }) => {
    const merged = mergeFlag(before, next);

    expect(merged.changed).toBe(changed);
    expect(merged.flags.map((flag) => flag.reason)).toEqual(reasons);
  });
});

function finding(
  reason: ScreeningFinding['reason'],
  evidence: Record<string, unknown>
): ScreeningFinding {
  return { reason, score: 0.5, evidence };
}

describe('packages/domain: creator screening reasons', () => {
  it.each([
    { name: 'a duplicate', reasons: ['DUPLICATE'], told: ['DUPLICATE'] },
    { name: 'a match with a taken-down video', reasons: ['KNOWN_REJECTED'], told: ['DUPLICATE'] },
    {
      name: 'both kinds of match, once',
      reasons: ['KNOWN_REJECTED', 'DUPLICATE'],
      told: ['DUPLICATE'],
    },
    { name: 'a partial match, never told', reasons: ['PARTIAL_MATCH'], told: [] },
    {
      name: 'several, in a fixed order',
      reasons: ['SCREEN_ERROR', 'NSFW', 'BLANK'],
      told: ['NSFW', 'BLANK', 'SCREEN_ERROR'],
    },
  ] as const)('tells $name', ({ reasons, told }) => {
    expect(creatorScreeningReasons(reasons.map((reason) => ({ reason })))).toEqual(told);
  });
});
