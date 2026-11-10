import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { updateCommentSettings } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { SETTINGS } from '#app/features/comments/__tests__/render-settings';
import { useSettingsSection } from '../use-settings-section';

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={createQueryClient()}>
    <AppProviders>{children}</AppProviders>
  </QueryClientProvider>
);

const mount = (settings = SETTINGS) =>
  renderHook(() => useSettingsSection(settings, ['reviewMode']), { wrapper });

describe('apps/client/studio: useSettingsSection', () => {
  it('starts clean with the fields the section owns', () => {
    const { result } = mount();

    expect(result.current.draft).toEqual({ reviewMode: 'none' });
    expect(result.current.dirty).toBe(false);
  });

  it('is dirty once a field differs, and clean again when it is changed back', () => {
    const { result } = mount();

    act(() => result.current.change({ reviewMode: 'all' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.change({ reviewMode: 'none' }));

    expect(result.current.dirty).toBe(false);
  });

  it('saves the whole document with only its own fields changed', async () => {
    const sent: unknown[] = [];
    apiServer.use(
      mockEndpoint(updateCommentSettings, async ({ request }) => {
        const body = await request.json();
        sent.push(body);
        return HttpResponse.json(body as typeof SETTINGS);
      })
    );
    const { result } = mount();

    act(() => result.current.change({ reviewMode: 'links' }));
    act(() => result.current.save());

    await waitFor(() => expect(result.current.saving).toBe(false));
    expect(sent).toEqual([{ ...SETTINGS, reviewMode: 'links' }]);
  });
});
