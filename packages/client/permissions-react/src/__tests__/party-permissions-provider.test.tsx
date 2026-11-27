import type { WatchPartyViewer } from '@vp/permissions';
import { renderToStaticMarkup } from 'react-dom/server';
import { PartyPermissionsProvider, usePartyAbility } from '../party-permissions-provider';

const MEMBER: WatchPartyViewer = {
  permissions: ['chat.post'],
  topPosition: 1,
  isOwner: false,
  kind: 'user',
};

function Reader() {
  return <span>{usePartyAbility().can('chat.post', 'WatchParty') ? 'CAN' : 'CANNOT'}</span>;
}

describe('@vp/permissions-react: PartyPermissionsProvider', () => {
  it('gives its tree the ability of the viewer seat', () => {
    const html = renderToStaticMarkup(
      <PartyPermissionsProvider userContext={null} viewer={MEMBER}>
        <Reader />
      </PartyPermissionsProvider>
    );

    expect(html).toContain('CAN');
  });

  it('throws without a provider', () => {
    expect(() => renderToStaticMarkup(<Reader />)).toThrow(
      'usePartyAbility must be used within PartyPermissionsProvider'
    );
  });
});
