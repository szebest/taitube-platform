import { JOB_PRIORITY, jobPriorityFor } from '../job-priority.rule.js';

describe('domain-rules/priority: jobPriorityFor', () => {
  it.each([
    { tier: 'free', expected: JOB_PRIORITY.free },
    { tier: 'pro', expected: JOB_PRIORITY.paid },
    { tier: 'enterprise', expected: JOB_PRIORITY.paid },
    { tier: undefined, expected: JOB_PRIORITY.free },
  ] as const)('gives a $tier owner priority $expected', ({ tier, expected }) => {
    expect(jobPriorityFor(tier)).toBe(expected);
  });

  it('puts a paid owner ahead of a free one, lower numbers running first', () => {
    expect(JOB_PRIORITY).toEqual({ paid: 1, free: 5 });
  });
});
