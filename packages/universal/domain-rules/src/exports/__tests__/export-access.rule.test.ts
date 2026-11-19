import { expectErr, expectOk } from '@kit/testing/result';
import type { ActingChannel, DataExport } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { decideExportAccess, decideReadableExportKinds } from '../export-access.rule';

const memberAs = (role: 'analytics' | 'moderator' | 'manager'): UserContext => ({
  id: `${role}-1`,
  role: 'USER',
  memberships: { 'chan-1': { role, ownerId: 'owner-1' } },
});

const acting = (role: ActingChannel['role']): ActingChannel => ({
  channelId: 'chan-1',
  ownerId: 'owner-1',
  role,
});

const exportOf = (overrides: Partial<DataExport>): DataExport => ({
  id: 'e1',
  channelId: 'chan-1',
  requestedBy: 'owner-1',
  kind: 'comments',
  params: {},
  format: 'csv',
  status: 'ready',
  objectKey: 'exports/chan-1/e1',
  rowCount: 3,
  failure: null,
  expiresAt: null,
  createdAt: new Date('2026-03-01T12:00:00.000Z'),
  ...overrides,
});

describe('@vp/domain-rules: decideExportAccess', () => {
  it.each([
    { scenario: 'is missing', found: null },
    { scenario: 'belongs to another channel', found: exportOf({ channelId: 'chan-2' }) },
  ])('answers not found when the export $scenario', ({ found }) => {
    const decided = decideExportAccess({
      user: memberAs('manager'),
      acting: acting('manager'),
      access: 'read',
      exportId: 'e1',
      found,
    });

    expect(expectErr(decided)).toMatchObject({ code: ErrorCodes.EXPORT_NOT_FOUND, exportId: 'e1' });
  });

  it.each([
    { access: 'read', kind: 'comments', code: ErrorCodes.FORBIDDEN },
    { access: 'delete', kind: 'videos', code: ErrorCodes.FORBIDDEN },
  ] as const)('refuses an analytics viewer to $access a $kind export', ({ access, kind, code }) => {
    const decided = decideExportAccess({
      user: memberAs('analytics'),
      acting: acting('analytics'),
      access,
      exportId: 'e1',
      found: exportOf({ kind }),
    });

    expect(expectErr(decided)).toMatchObject({ code });
  });

  it('hands an analytics viewer an analytics export', () => {
    const found = exportOf({ kind: 'channel_analytics' });

    expect(
      expectOk(
        decideExportAccess({
          user: memberAs('analytics'),
          acting: acting('analytics'),
          access: 'delete',
          exportId: 'e1',
          found,
        })
      )
    ).toBe(found);
  });
});

describe('@vp/domain-rules: decideExportAccess before the lookup', () => {
  it('refuses a moderator, who may export nothing, rather than answer not found', () => {
    const decided = decideExportAccess({
      user: memberAs('moderator'),
      acting: acting('moderator'),
      access: 'read',
      exportId: 'e1',
      found: null,
    });

    expect(expectErr(decided)).toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });
});

describe('@vp/domain-rules: decideReadableExportKinds', () => {
  it.each([
    { role: 'manager', kinds: ['video_analytics', 'channel_analytics', 'comments', 'videos'] },
    { role: 'analytics', kinds: ['video_analytics', 'channel_analytics'] },
  ] as const)('lists what a $role may see', ({ role, kinds }) => {
    expect(
      expectOk(decideReadableExportKinds({ user: memberAs(role), acting: acting(role) }))
    ).toEqual(kinds);
  });

  it('refuses a moderator, who may see none', () => {
    const decided = decideReadableExportKinds({
      user: memberAs('moderator'),
      acting: acting('moderator'),
    });

    expect(expectErr(decided)).toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });
});
