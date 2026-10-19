import { canAccessAdmin } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { account } from '@vp/web-testing';
import { renderToStaticMarkup } from 'react-dom/server';

import { GUEST, type Session } from '../session';
import { SessionProvider, useAccount } from '../session-provider';

function Viewer() {
  const signedIn = useAccount();
  const admin = useCan(canAccessAdmin);
  return <p>{`${signedIn?.channel.displayName ?? 'guest'}, admin: ${admin}`}</p>;
}

function renderViewer(session?: Session) {
  return renderToStaticMarkup(
    session ? (
      <SessionProvider session={session}>
        <Viewer />
      </SessionProvider>
    ) : (
      <Viewer />
    )
  );
}

describe('@vp/queries: SessionProvider', () => {
  it.each<{ viewer: string; session: Session; rendered: string }>([
    { viewer: 'a guest', session: GUEST, rendered: 'guest, admin: false' },
    {
      viewer: 'a creator',
      session: { status: 'signed-in', account: account() },
      rendered: 'The Creator, admin: false',
    },
    {
      viewer: 'an admin',
      session: { status: 'signed-in', account: account({ role: 'ADMIN' }) },
      rendered: 'The Creator, admin: true',
    },
  ])(
    'hands $viewer their account and the permissions their role grants',
    ({ session, rendered }) => {
      expect(renderViewer(session)).toBe(`<p>${rendered}</p>`);
    }
  );

  it('refuses useAccount outside the provider, naming it', () => {
    expect(() => renderViewer()).toThrow('useAccount must be used within SessionProvider');
  });
});
