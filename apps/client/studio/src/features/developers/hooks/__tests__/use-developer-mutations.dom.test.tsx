import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createQueryClient } from '@vp/queries';
import { apiServer } from '@vp/web-testing';
import type { PropsWithChildren } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import {
  EXPORT_ID,
  serveDevelopers,
  TOKEN_ID,
  WEBHOOK_ID,
} from '#app/features/developers/__tests__/developers-api.fixture';
import {
  useCreateToken,
  useCreateWebhook,
  useDeleteExport,
  useDeleteWebhook,
  useExportDownload,
  useRequestExport,
  useRevokeToken,
  useTestWebhook,
} from '../use-developer-mutations';

function mutate<T>(useHook: () => { mutateAsync: (input: T) => Promise<unknown> }, input: T) {
  const client = createQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <AppProviders>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </AppProviders>
  );
  return renderHook(useHook, { wrapper }).result.current.mutateAsync(input);
}

describe('apps/client/studio: developer mutations', () => {
  it('sends each write to its endpoint', async () => {
    const { requests, handlers } = serveDevelopers();
    apiServer.use(...handlers);

    await mutate(useCreateToken, { name: 'CI', scopes: ['videos:read'] });
    await mutate(useRevokeToken, TOKEN_ID);
    await mutate(useCreateWebhook, {
      url: 'https://hooks.example.com/in',
      events: ['video.ready'],
    });
    await mutate(useTestWebhook, WEBHOOK_ID);
    await mutate(useDeleteWebhook, WEBHOOK_ID);
    await mutate(useRequestExport, { kind: 'videos', format: 'json' });
    await mutate(useDeleteExport, EXPORT_ID);

    expect(requests).toEqual({
      tokens: [{ name: 'CI', scopes: ['videos:read'] }],
      revoked: [TOKEN_ID],
      webhooks: [{ url: 'https://hooks.example.com/in', events: ['video.ready'] }],
      removed: [WEBHOOK_ID],
      tested: [WEBHOOK_ID],
      exports: [{ kind: 'videos', format: 'json' }],
      deletedExports: [EXPORT_ID],
    });
  });

  it('asks for a download address only when the creator downloads', async () => {
    apiServer.use(...serveDevelopers().handlers);

    expect(await mutate(useExportDownload, EXPORT_ID)).toMatchObject({
      id: EXPORT_ID,
      downloadUrl: null,
    });
  });
});
