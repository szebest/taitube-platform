import type { WatchPartyViewer } from '@vp/permissions';
import { renderToStaticMarkup } from 'react-dom/server';
import { PartyCan, type PartyCanProps } from '../party-can';
import { PartyPermissionsProvider } from '../party-permissions-provider';

const MEMBER: WatchPartyViewer = {
  permissions: ['chat.post'],
  topPosition: 1,
  isOwner: false,
  kind: 'user',
};

function renderCan(gate: PartyCanProps['gate']): string {
  return renderToStaticMarkup(
    <PartyPermissionsProvider userContext={null} viewer={MEMBER}>
      <PartyCan gate={gate} fallback={<span>DENIED</span>}>
        <span>ALLOWED</span>
      </PartyCan>
    </PartyPermissionsProvider>
  );
}

describe('@vp/permissions-react: PartyCan', () => {
  it('renders its children where the room ability allows the gate', () => {
    expect(renderCan({ kind: 'permission', permission: 'chat.post' })).toContain('ALLOWED');
  });

  it('renders the fallback where it does not', () => {
    expect(renderCan({ kind: 'permission', permission: 'queue.add' })).toContain('DENIED');
  });
});
