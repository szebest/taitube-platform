import { COMMENT_REPORT_REASONS, COMMENT_REPORT_RESOLUTIONS } from '../comment-report';

describe('domain: comment report', () => {
  it.each([
    {
      name: 'reasons',
      values: COMMENT_REPORT_REASONS,
      expected: ['spam', 'harassment', 'hate', 'misinformation', 'other'],
    },
    { name: 'resolutions', values: COMMENT_REPORT_RESOLUTIONS, expected: ['removed', 'dismissed'] },
  ])('lists the $name a report can carry', ({ values, expected }) => {
    expect(values).toEqual(expected);
  });
});
