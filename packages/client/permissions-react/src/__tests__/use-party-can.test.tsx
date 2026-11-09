import type { WatchPartyViewer } from '@vp/permissions';
import { renderToStaticMarkup } from 'react-dom/server';
import { PartyPermissionsProvider } from '../party-permissions-provider';
import { type PartyGate, usePartyCan } from '../use-party-can';

const MODERATOR: WatchPartyViewer = {
  permissions: ['chat.moderate', 'members.kick', 'roles.manage'],
  topPosition: 50,
  isOwner: false,
  kind: 'user',
};

function Probe({ gate }: { gate: PartyGate }) {
  return <span>{usePartyCan(gate) ? 'YES' : 'NO'}</span>;
}

function answer(gate: PartyGate): string {
  return renderToStaticMarkup(
    <PartyPermissionsProvider userContext={null} viewer={MODERATOR}>
      <Probe gate={gate} />
    </PartyPermissionsProvider>
  );
}

describe('@vp/permissions-react: usePartyCan', () => {
  it.each<{ scenario: string; gate: PartyGate; allowed: boolean }>([
    { scenario: 'a held permission', gate: { permission: 'chat.moderate' }, allowed: true },
    { scenario: 'a permission the roles lack', gate: { permission: 'queue.add' }, allowed: false },
    {
      scenario: 'kicking a member below',
      gate: { action: 'kick', member: { topPosition: 10, isOwner: false, kind: 'user' } },
      allowed: true,
    },
    {
      scenario: 'kicking a member at the same position',
      gate: { action: 'kick', member: { topPosition: 50, isOwner: false, kind: 'user' } },
      allowed: false,
    },
    {
      scenario: 'kicking the owner',
      gate: { action: 'kick', member: { topPosition: 0, isOwner: true, kind: 'user' } },
      allowed: false,
    },
    {
      scenario: 'editing a role below',
      gate: { action: 'update', role: { key: null, position: 10 } },
      allowed: true,
    },
    {
      scenario: 'editing a role at their own position',
      gate: { action: 'update', role: { key: null, position: 50 } },
      allowed: false,
    },
  ])('answers $scenario', ({ gate, allowed }) => {
    expect(answer(gate)).toContain(allowed ? 'YES' : 'NO');
  });
});
