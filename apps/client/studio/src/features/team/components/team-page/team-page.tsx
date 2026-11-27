import { EmptyState, PageHeader } from '@kit/components';
import { Tabs } from '@kit/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { canReadChannelTeam } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';
import { AuditPanel } from '../audit-panel/audit-panel';
import { MembersPanel } from '../members-panel/members-panel';

const TABS = ['members', 'audit'] as const;

/** The channel team: who works on it and with what role, and the log of what they changed. */
export function TeamPage() {
  const { tOr } = useT();
  const navigate = useNavigate({ from: '/team' });
  const { tab, actor, action } = useSearch({ from: '/_authed/team' });
  const { channelId, ownerId } = useActiveChannel();
  const mayRead = useCan(canReadChannelTeam, { channel: { channelId, ownerId } });

  return (
    <div className="flex flex-col gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.teamTitle', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      {mayRead ? (
        <Tabs.Root
          value={tab}
          onValueChange={(next) => {
            const known = TABS.find((name) => name === next);
            if (known)
              void navigate({ search: (previous) => ({ ...previous, tab: known }), replace: true });
          }}
        >
          <Tabs.List aria-label={tOr('studio.teamTabs', {}, '')}>
            <Tabs.Tab value="members">{tOr('studio.teamTabMembers', {}, '')}</Tabs.Tab>
            <Tabs.Tab value="audit">{tOr('studio.teamTabAudit', {}, '')}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="members">
            <MembersPanel />
          </Tabs.Panel>
          <Tabs.Panel value="audit">
            <AuditPanel
              filters={{ actorUserId: actor, action }}
              onFiltersChange={({ actorUserId, action: nextAction }) =>
                void navigate({
                  search: (previous) => ({ ...previous, actor: actorUserId, action: nextAction }),
                  replace: true,
                })
              }
            />
          </Tabs.Panel>
        </Tabs.Root>
      ) : (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.teamNoAccessTitle', {}, '')}</EmptyState.Title>
          <EmptyState.Description>
            {tOr('studio.teamNoAccessDescription', {}, '')}
          </EmptyState.Description>
        </EmptyState.Root>
      )}
    </div>
  );
}
