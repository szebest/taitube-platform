import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { type PostTiming, decidePostTiming } from '../post-timing.rule';
import { NOW } from './poll-fixtures';

const later = new Date(NOW.getTime() + 60_000);

describe('@vp/domain-rules: decidePostTiming', () => {
  it.each<{
    name: string;
    current: 'draft' | 'scheduled' | 'published' | null;
    timing: PostTiming;
    expected: object;
  }>([
    {
      name: 'a new post now',
      current: null,
      timing: { mode: 'now' },
      expected: { status: 'published' },
    },
    {
      name: 'a new draft',
      current: null,
      timing: { mode: 'draft' },
      expected: { status: 'draft', publishAt: null },
    },
    {
      name: 'a new schedule',
      current: null,
      timing: { mode: 'schedule', publishAt: later },
      expected: { status: 'scheduled', publishAt: later },
    },
    {
      name: 'a draft published now',
      current: 'draft',
      timing: { mode: 'now' },
      expected: { status: 'published' },
    },
    {
      name: 'a scheduled post back to a draft',
      current: 'scheduled',
      timing: { mode: 'draft' },
      expected: { status: 'draft', publishAt: null },
    },
    {
      name: 'a published post saved as it is',
      current: 'published',
      timing: { mode: 'now' },
      expected: { status: 'published' },
    },
  ])('decides $name', ({ current, timing, expected }) => {
    const result = decidePostTiming({ current, timing, now: NOW });

    expect(isOk(result) && result.value).toEqual(expected);
  });

  it.each<{
    name: string;
    current: 'draft' | 'published' | null;
    timing: PostTiming;
    reason: string;
  }>([
    {
      name: 'a schedule in the past',
      current: null,
      timing: { mode: 'schedule', publishAt: new Date(NOW.getTime() - 1) },
      reason: 'in_past',
    },
    {
      name: 'a schedule of exactly now',
      current: 'draft',
      timing: { mode: 'schedule', publishAt: NOW },
      reason: 'in_past',
    },
    {
      name: 'a published post turned into a draft',
      current: 'published',
      timing: { mode: 'draft' },
      reason: 'already_published',
    },
    {
      name: 'a published post scheduled',
      current: 'published',
      timing: { mode: 'schedule', publishAt: later },
      reason: 'already_published',
    },
  ])('refuses $name', ({ current, timing, reason }) => {
    const result = decidePostTiming({ current, timing, now: NOW });

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.POST_SCHEDULE_INVALID,
      reason,
    });
  });
});
