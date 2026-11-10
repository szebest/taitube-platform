import type { ScreeningFinding, ScreeningReason } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideScreening } from '../decide-screening.rule';
import { THRESHOLDS } from './thresholds';

const finding = (
  reason: ScreeningReason,
  score: number,
  evidence: Record<string, unknown> = {}
): ScreeningFinding => ({ reason, score, evidence });

describe('@vp/domain-rules: decideScreening', () => {
  it.each([
    { name: 'no findings', findings: [], outcome: 'PASS', held: [], flagged: [] },
    {
      name: 'a duplicate at the coverage bar',
      findings: [finding('DUPLICATE', 0.9)],
      outcome: 'HOLD',
      held: ['DUPLICATE'],
      flagged: [],
    },
    {
      name: 'a duplicate under the bar',
      findings: [finding('DUPLICATE', 0.89)],
      outcome: 'PASS',
      held: [],
      flagged: ['DUPLICATE'],
    },
    {
      name: 'a duplicate in the same channel',
      findings: [finding('DUPLICATE', 1, { sameChannel: true })],
      outcome: 'PASS',
      held: [],
      flagged: ['DUPLICATE'],
    },
    {
      name: 'a partial match, however strong',
      findings: [finding('PARTIAL_MATCH', 0.89)],
      outcome: 'PASS',
      held: [],
      flagged: ['PARTIAL_MATCH'],
    },
    {
      name: 'a known rejected video at the bar',
      findings: [finding('KNOWN_REJECTED', 0.9)],
      outcome: 'HOLD',
      held: ['KNOWN_REJECTED'],
      flagged: [],
    },
    {
      name: 'a known rejected video under the bar',
      findings: [finding('KNOWN_REJECTED', 0.5)],
      outcome: 'PASS',
      held: [],
      flagged: ['KNOWN_REJECTED'],
    },
    {
      name: 'nsfw with both bars met',
      findings: [finding('NSFW', 0.85, { share: 0.1 })],
      outcome: 'HOLD',
      held: ['NSFW'],
      flagged: [],
    },
    {
      name: 'nsfw with one odd frame',
      findings: [finding('NSFW', 0.99, { share: 0.09 })],
      outcome: 'PASS',
      held: [],
      flagged: ['NSFW'],
    },
    {
      name: 'nsfw with no frame over the bar',
      findings: [finding('NSFW', 0.84, { share: 0.5 })],
      outcome: 'PASS',
      held: [],
      flagged: ['NSFW'],
    },
    {
      name: 'nsfw without a share',
      findings: [finding('NSFW', 0.99)],
      outcome: 'PASS',
      held: [],
      flagged: ['NSFW'],
    },
    {
      name: 'a blank video at the bar',
      findings: [finding('BLANK', 0.95)],
      outcome: 'HOLD',
      held: ['BLANK'],
      flagged: [],
    },
    {
      name: 'a blank video under the bar',
      findings: [finding('BLANK', 0.94)],
      outcome: 'PASS',
      held: [],
      flagged: ['BLANK'],
    },
    {
      name: 'spam at the hold score',
      findings: [finding('METADATA_SPAM', 0.8)],
      outcome: 'HOLD',
      held: ['METADATA_SPAM'],
      flagged: [],
    },
    {
      name: 'spam under the hold score',
      findings: [finding('METADATA_SPAM', 0.4)],
      outcome: 'PASS',
      held: [],
      flagged: ['METADATA_SPAM'],
    },
    {
      name: 'a screening error, whatever its score',
      findings: [finding('SCREEN_ERROR', 0)],
      outcome: 'HOLD',
      held: ['SCREEN_ERROR'],
      flagged: [],
    },
    {
      name: 'a hold beside a flag',
      findings: [finding('PARTIAL_MATCH', 0.5), finding('BLANK', 1)],
      outcome: 'HOLD',
      held: ['BLANK'],
      flagged: ['PARTIAL_MATCH'],
    },
  ] as const)('is $outcome for $name', ({ findings, outcome, held, flagged }) => {
    const verdict = expectOk(decideScreening(findings, THRESHOLDS));

    expect(verdict.outcome).toBe(outcome);
    expect(verdict.reasons.map((f) => f.reason)).toEqual(held);
    expect(verdict.flags.map((f) => f.reason)).toEqual(flagged);
  });

  it.each([
    {
      name: 'the strongest held finding for a hold',
      findings: [finding('BLANK', 0.97), finding('DUPLICATE', 0.92), finding('PARTIAL_MATCH', 1)],
      score: 0.97,
    },
    {
      name: 'the strongest flag for a pass',
      findings: [finding('PARTIAL_MATCH', 0.6), finding('METADATA_SPAM', 0.4)],
      score: 0.6,
    },
    { name: 'zero for nothing', findings: [], score: 0 },
  ])('scores $name', ({ findings, score }) => {
    expect(expectOk(decideScreening(findings, THRESHOLDS)).score).toBe(score);
  });

  it('orders the reasons as the vocabulary does, strongest first within one', () => {
    const verdict = expectOk(
      decideScreening(
        [
          finding('SCREEN_ERROR', 0),
          finding('BLANK', 1),
          finding('DUPLICATE', 0.91),
          finding('DUPLICATE', 0.99),
        ],
        THRESHOLDS
      )
    );

    expect(verdict.reasons.map((f) => [f.reason, f.score])).toEqual([
      ['DUPLICATE', 0.99],
      ['DUPLICATE', 0.91],
      ['BLANK', 1],
      ['SCREEN_ERROR', 0],
    ]);
  });

  it('keeps each finding with its evidence', () => {
    const duplicate = finding('DUPLICATE', 0.95, { matchedVideoId: 'v0' });

    expect(expectOk(decideScreening([duplicate], THRESHOLDS)).reasons).toEqual([duplicate]);
  });

  it.each([
    { name: 'above one', score: 1.01 },
    { name: 'below zero', score: -0.1 },
    { name: 'not a number', score: Number.NaN },
    { name: 'infinite', score: Number.POSITIVE_INFINITY },
  ])('refuses a score $name', ({ score }) => {
    const failure = expectErr(decideScreening([finding('NSFW', score)], THRESHOLDS));

    expect(failure).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, reason: 'NSFW' });
  });
});
