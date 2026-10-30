import type { CommentReport } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { andThen, err, ok, type Result } from '@vp/result';
import { decideAdminAccess } from '../admin/admin-access.rule';
import type { AuthorizationFailure } from '../authorize';
import {
  type ReportAlreadyResolved,
  type ReportNotFound,
  reportAlreadyResolved,
  reportNotFound,
} from './failures';

export interface ResolveReportInput {
  readonly actor: UserContext | null;
  readonly report: CommentReport | null;
  readonly reportId: string;
}

export type ResolveReportFailure = AuthorizationFailure | ReportNotFound | ReportAlreadyResolved;

export function decideReportResolve(
  input: ResolveReportInput
): Result<CommentReport, ResolveReportFailure> {
  return andThen(
    decideAdminAccess(input.actor),
    (): Result<CommentReport, ResolveReportFailure> => {
      const { report } = input;
      if (!report) return err(reportNotFound(input.reportId));
      return report.resolvedAt === null ? ok(report) : err(reportAlreadyResolved(report.id));
    }
  );
}
