import { expectErr, expectOk } from '@kit/testing/result';
import type { ActingChannel, DataExportKind, DataExportUsage } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { decideExportRequest } from '../request-export.rule';

const owner: UserContext = { id: 'owner-1', role: 'USER' };
const analyticsViewer: UserContext = {
  id: 'analytics-1',
  role: 'USER',
  memberships: { 'chan-1': { role: 'analytics', ownerId: 'owner-1' } },
};
const editor: UserContext = {
  id: 'editor-1',
  role: 'USER',
  memberships: { 'chan-1': { role: 'editor', ownerId: 'owner-1' } },
};

const actingAs = (role: ActingChannel['role']): ActingChannel => ({
  channelId: 'chan-1',
  ownerId: 'owner-1',
  role,
});
const IDLE: DataExportUsage = { running: false, today: 0 };

describe('@vp/domain-rules: decideExportRequest', () => {
  it.each<{ user: UserContext; role: ActingChannel['role']; kind: DataExportKind }>([
    { user: analyticsViewer, role: 'analytics', kind: 'comments' },
    { user: editor, role: 'editor', kind: 'channel_analytics' },
  ])('refuses a $role asking for $kind', ({ user, role, kind }) => {
    const decided = decideExportRequest({ user, acting: actingAs(role), kind, usage: IDLE });

    expect(expectErr(decided)).toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });

  it.each<{ scenario: string; usage: DataExportUsage; code: string }>([
    {
      scenario: 'one already runs',
      usage: { running: true, today: 1 },
      code: ErrorCodes.EXPORT_IN_PROGRESS,
    },
    {
      scenario: 'ten were asked for today',
      usage: { running: false, today: 10 },
      code: ErrorCodes.EXPORT_DAILY_LIMIT,
    },
  ])('refuses the owner when $scenario', ({ usage, code }) => {
    const decided = decideExportRequest({
      user: owner,
      acting: actingAs('owner'),
      kind: 'videos',
      usage,
    });

    expect(expectErr(decided)).toMatchObject({ code });
  });

  it.each<{ user: UserContext; role: ActingChannel['role']; kind: DataExportKind }>([
    { user: owner, role: 'owner', kind: 'comments' },
    { user: analyticsViewer, role: 'analytics', kind: 'video_analytics' },
  ])('lets a $role export $kind under the cap', ({ user, role, kind }) => {
    const decided = decideExportRequest({
      user,
      acting: actingAs(role),
      kind,
      usage: { running: false, today: 9 },
    });

    expect(expectOk(decided)).toBe(user);
  });
});
