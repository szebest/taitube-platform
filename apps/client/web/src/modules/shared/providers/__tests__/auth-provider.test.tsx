import { usePermissions } from '@vp/permissions-react';
import { OWNER_ID } from '@vp/web-testing';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubBrowser } from '#app/__tests__/browser';
import { renderPage, signIn } from '#app/__tests__/render-page';
import { useAuth } from '../auth-provider';

function AuthProbe() {
  const { account: signedIn, isLoading } = useAuth();
  const name = signedIn?.channel.displayName ?? 'nobody';
  return <span>{`account=${name} loading=${isLoading}`}</span>;
}

function ViewerProbe() {
  return <span>{`viewer=${usePermissions().userContext?.id ?? 'guest'}`}</span>;
}

describe('apps/client/web: auth provider', () => {
  it('holds no account and is not loading for a viewer without a token', async () => {
    expect(await renderPage(<AuthProbe />)).toContain('account=nobody loading=false');
  });

  it('is loading while the account of a viewer with a token is on its way', async () => {
    stubBrowser({ token: 'signed-in' });

    expect(await renderPage(<AuthProbe />)).toContain('account=nobody loading=true');
  });

  it('holds the account the API returned for the token', async () => {
    const queryClient = signIn();

    expect(await renderPage(<AuthProbe />, { queryClient })).toContain(
      'account=The Creator loading=false'
    );
  });

  it('refuses useAuth outside the provider', async () => {
    expect(() => renderToStaticMarkup(<AuthProbe />)).toThrow(
      'useAuth must be used within AuthProvider'
    );
  });

  it("grants the permissions of the signed-in account's user", async () => {
    const queryClient = signIn();

    expect(await renderPage(<ViewerProbe />, { queryClient })).toContain(`viewer=${OWNER_ID}`);
  });
});
