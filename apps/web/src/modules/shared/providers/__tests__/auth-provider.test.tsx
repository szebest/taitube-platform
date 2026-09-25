import { renderToStaticMarkup } from 'react-dom/server';
import { createApiStore } from '../../../../__tests__/api-store';
import { stubBrowser } from '../../../../__tests__/browser';
import { account } from '../../../../__tests__/fixtures';
import { renderPage, signIn } from '../../../../__tests__/render-page';
import { useAuth, useOptionalAuth } from '../auth-provider';

function AuthProbe() {
  const { account: signedIn, isLoading } = useAuth();
  const name = signedIn?.channel.displayName ?? 'nobody';
  return <span>{`account=${name} loading=${isLoading}`}</span>;
}

function OptionalAuthProbe() {
  return <span>{useOptionalAuth() === undefined ? 'no auth context' : 'auth context'}</span>;
}

describe('apps/web: auth provider', () => {
  it('holds no account and is not loading for a viewer without a token', async () => {
    expect(await renderPage(<AuthProbe />)).toContain('account=nobody loading=false');
  });

  it('is loading while the account of a viewer with a token is on its way', async () => {
    stubBrowser({ token: 'signed-in' });

    expect(await renderPage(<AuthProbe />)).toContain('account=nobody loading=true');
  });

  it('holds the account the API returned for the token', async () => {
    const store = createApiStore();
    await signIn(store, account());

    expect(await renderPage(<AuthProbe />, { store })).toContain(
      'account=The Creator loading=false'
    );
  });

  it('refuses useAuth outside the provider', async () => {
    expect(() => renderToStaticMarkup(<AuthProbe />)).toThrow(
      'useAuth must be used within AuthProvider'
    );
  });

  it('lets useOptionalAuth read nothing outside the provider', async () => {
    expect(renderToStaticMarkup(<OptionalAuthProbe />)).toContain('no auth context');
  });
});
