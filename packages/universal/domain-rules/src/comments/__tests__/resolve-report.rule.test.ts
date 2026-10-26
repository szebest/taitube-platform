import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { ADMIN, MODERATOR, OWNER, aCommentReport } from '../../__tests__/entities';
import { decideReportResolve } from '../resolve-report.rule';

const report = aCommentReport();

describe('@vp/domain-rules: decideReportResolve', () => {
  it('lets an admin resolve an open report', () => {
    const result = decideReportResolve({ actor: ADMIN, report, reportId: report.id });

    expect(isOk(result) && result.value).toBe(report);
  });

  it.each([
    { scenario: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'a moderator', actor: MODERATOR, code: ErrorCodes.FORBIDDEN },
    { scenario: 'the video owner', actor: OWNER, code: ErrorCodes.FORBIDDEN },
  ])('refuses $scenario with $code', ({ actor, code }) => {
    const result = decideReportResolve({ actor, report, reportId: report.id });

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it.each([
    { scenario: 'an absent report', target: null, code: ErrorCodes.REPORT_NOT_FOUND },
    {
      scenario: 'a resolved report',
      target: aCommentReport({ resolvedAt: new Date(), resolution: 'dismissed' }),
      code: ErrorCodes.REPORT_ALREADY_RESOLVED,
    },
  ])('refuses $scenario with $code', ({ target, code }) => {
    const result = decideReportResolve({ actor: ADMIN, report: target, reportId: 'report-1' });

    expect(isErr(result) && result.error.code).toBe(code);
  });
});
