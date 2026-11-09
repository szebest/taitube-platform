import { screen, within } from '@testing-library/react';
import type { ChannelAuditPageView } from '@vp/api-contracts';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { EDITOR_ID, roleChanged } from '#app/features/team/__tests__/team-api.fixture';

type Entry = ChannelAuditPageView['items'][number];

const id = (n: number) => `0190c3a0-5e1d-7000-8000-0000000ee00${n}`;

const base = {
  targetId: EDITOR_ID,
  actorUserId: null,
  actor: null,
  createdAt: '2026-01-01T00:00:00.000Z',
} as const;
const invited = { inviteeUserId: EDITOR_ID, role: 'editor' } as const;

const invitedEntry: Entry = {
  ...base,
  id: id(1),
  action: 'invite.created',
  targetType: 'invite',
  meta: invited,
};
const editedVideo: Entry = {
  ...base,
  id: id(8),
  action: 'video.updated',
  targetType: 'video',
  meta: { fields: ['title', 'tags', 'unheard-of'] },
};

const entries: { scenario: string; entry: Entry; shown: string[] }[] = [
  {
    scenario: 'an invite sent',
    entry: invitedEntry,
    shown: ['Invited someone', 'Editor'],
  },
  {
    scenario: 'an invite accepted',
    entry: { ...base, id: id(2), action: 'invite.accepted', targetType: 'invite', meta: invited },
    shown: ['Accepted an invite', 'Editor'],
  },
  {
    scenario: 'an invite declined',
    entry: { ...base, id: id(3), action: 'invite.declined', targetType: 'invite', meta: invited },
    shown: ['Declined an invite', 'Editor'],
  },
  {
    scenario: 'an invite revoked',
    entry: { ...base, id: id(4), action: 'invite.revoked', targetType: 'invite', meta: invited },
    shown: ['Revoked an invite', 'Editor'],
  },
  {
    scenario: 'a role changed',
    entry: roleChanged(id(5)),
    shown: ['Changed a role', 'from Editor to Manager'],
  },
  {
    scenario: 'a member removed',
    entry: {
      ...base,
      id: id(6),
      action: 'member.removed',
      targetType: 'member',
      meta: { role: 'moderator' },
    },
    shown: ['Removed a member', 'Moderator'],
  },
  {
    scenario: 'a member who left',
    entry: {
      ...base,
      id: id(7),
      action: 'member.left',
      targetType: 'member',
      meta: { role: 'analytics' },
    },
    shown: ['Left the team', 'Analytics viewer'],
  },
  {
    scenario: 'a video edited',
    entry: editedVideo,
    shown: ['Edited a video', 'title and tags'],
  },
];

describe('apps/client/studio: AuditEntry', () => {
  it.each(entries)('words $scenario', async ({ entry, shown }) => {
    await renderTeam('/team?tab=audit', { state: { auditPages: [[entry]] } });

    const row = await within(
      await screen.findByRole('list', { name: 'Audit log entries' })
    ).findByRole('listitem');

    for (const text of shown) expect(within(row).getByText(text)).toBeInTheDocument();
  });

  it('names a member who deleted their account as a former member', async () => {
    await renderTeam('/team?tab=audit', { state: { auditPages: [[invitedEntry]] } });

    expect(await screen.findByText('A former member')).toBeInTheDocument();
  });

  it('links the video an edit touched to its editor', async () => {
    await renderTeam('/team?tab=audit', { state: { auditPages: [[editedVideo]] } });

    expect(await screen.findByRole('link', { name: 'title and tags' })).toHaveAttribute(
      'href',
      `/videos/${EDITOR_ID}/edit`
    );
  });
});
