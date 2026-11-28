import {
  layoutLimitExceeded,
  layoutReferenceInvalid,
  layoutRevisionNotFound,
  layoutScheduleInvalid,
  layoutScheduleNotFound,
  layoutSlugInvalid,
  layoutStructureInvalid,
} from '../failures';

describe('@vp/domain-rules: layout failures', () => {
  it.each([
    {
      failure: layoutLimitExceeded('tabs', 10, 11),
      expected: { code: 'LAYOUT_LIMIT_EXCEEDED', limit: 'tabs', max: 10, actual: 11 },
    },
    {
      failure: layoutStructureInvalid('duplicate_tab', 'a'),
      expected: { code: 'LAYOUT_STRUCTURE_INVALID', reason: 'duplicate_tab', id: 'a' },
    },
    {
      failure: layoutSlugInvalid('live', 'reserved'),
      expected: { code: 'LAYOUT_SLUG_INVALID', slug: 'live', reason: 'reserved' },
    },
    {
      failure: layoutReferenceInvalid('video', 'v'),
      expected: { code: 'LAYOUT_REFERENCE_INVALID', kind: 'video', id: 'v' },
    },
    {
      failure: layoutScheduleInvalid(),
      expected: { code: 'LAYOUT_SCHEDULE_INVALID', reason: 'in_past' },
    },
    {
      failure: layoutRevisionNotFound('c', 'r'),
      expected: { code: 'REVISION_NOT_FOUND', channelId: 'c', revisionId: 'r' },
    },
    {
      failure: layoutScheduleNotFound('s'),
      expected: { code: 'LAYOUT_SCHEDULE_NOT_FOUND', scheduleId: 's' },
    },
  ])('carries $expected.code and its details', ({ failure, expected }) => {
    expect(failure).toMatchObject(expected);
  });
});
