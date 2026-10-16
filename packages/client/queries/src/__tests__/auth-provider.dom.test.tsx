import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { getAccount } from '@vp/api-contracts';
import { usePermissions } from '@vp/permissions-react';
import { OWNER_ID, account, apiServer } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { ApiProvider } from '../api-provider';
import { AuthProvider, useAuth } from '../auth-provider';
import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '../auth-token';
import { createQueryClient } from '../create-query-client';
import { api, mockEndpoint } from './api';

function AuthProbe() {
  const { account: signedIn, isLoading } = useAuth();
  const { userContext } = usePermissions();
  const name = signedIn?.channel.displayName ?? 'nobody';
  return (
    <output>{`account=${name} loading=${isLoading} viewer=${userContext?.id ?? 'guest'}`}</output>
  );
}

function renderAuth({ token }: { token?: string } = {}) {
  if (token) localStorage.setItem(AUTH_TOKEN_LOCAL_STORAGE_KEY, token);
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ApiProvider api={api}>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

describe('@vp/queries: AuthProvider', () => {
  afterEach(() => localStorage.clear());

  it('holds no account, is not loading and grants guest permissions without a token', () => {
    renderAuth();

    expect(screen.getByRole('status')).toHaveTextContent(
      'account=nobody loading=false viewer=guest'
    );
  });

  it("loads the token's account, then holds it and grants its user's permissions", async () => {
    apiServer.use(mockEndpoint(getAccount, () => HttpResponse.json(account())));

    renderAuth({ token: 'signed-in' });

    expect(screen.getByRole('status')).toHaveTextContent('account=nobody loading=true');
    expect(
      await screen.findByText(`account=The Creator loading=false viewer=${OWNER_ID}`)
    ).toBeInTheDocument();
  });

  it('refuses useAuth outside the provider, naming it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<AuthProbe />)).toThrow('useAuth must be used within AuthProvider');
  });
});
