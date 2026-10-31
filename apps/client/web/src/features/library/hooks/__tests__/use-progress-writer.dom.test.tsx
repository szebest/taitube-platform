import { screen, waitFor } from '@testing-library/react';
import { type RecordWatchProgressBody, recordWatchProgress } from '@vp/api-contracts';
import { account, api, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { holds, preferencesView } from '#app/features/settings/__tests__/preferences-fixtures';
import { preferencesQueryOptions } from '#app/features/settings/api/preferences-queries';
import { renderWatch } from '#app/features/watch/__tests__/render-watch';

import { DURATION } from '../../__tests__/progress-player';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('../../__tests__/progress-player')).ProgressPlayer,
}));

const PAUSED = preferencesView({
  version: 1,
  privacy: { historyPaused: true, playlistVisibility: 'private', subscriptionsVisible: false },
});

function recording() {
  const saved: RecordWatchProgressBody[] = [];
  const handler = mockEndpoint(recordWatchProgress, async ({ request }) => {
    const body = (await request.json()) as RecordWatchProgressBody;
    saved.push(body);
    return HttpResponse.json({
      videoId: VIDEO_ID,
      progressSeconds: body.progressSeconds,
      durationSeconds: body.durationSeconds,
      progressPercent: 0,
      completed: false,
      resumeAtSeconds: body.progressSeconds,
      watchedAt: '2026-03-10T12:00:00.000Z',
    });
  });
  return { saved, handler };
}

async function watching(options: Parameters<typeof renderWatch>[0] = {}) {
  const { saved, handler } = recording();
  const viewer = 'viewer' in options ? options.viewer : account();
  const rendered = await renderWatch({
    ...options,
    viewer,
    handlers: [handler, ...(options.handlers ?? [])],
  });
  if (viewer) {
    await waitFor(() =>
      expect(
        rendered.queryClient.getQueryState(preferencesQueryOptions(api).queryKey)?.status
      ).toBe('success')
    );
  }
  const press = (name: string) => rendered.user.click(screen.getByRole('button', { name }));
  const settled = () => waitFor(() => expect(rendered.queryClient.isMutating()).toBe(0));
  return { saved, press, settled };
}

describe('apps/client/web: useProgressWriter', () => {
  it('saves a heartbeat on the first tick and then every ten seconds of playhead', async () => {
    const { saved, press, settled } = await watching();

    for (const second of [0, 4, 5, 10, 12, 14, 21, 30]) await press(`Play to ${second}`);
    await settled();

    expect(saved.map(({ progressSeconds }) => progressSeconds)).toEqual([0, 10, 21]);
    expect(saved.every(({ reason }) => reason === 'heartbeat')).toBe(true);
    expect(saved[0]).toMatchObject({ videoId: VIDEO_ID, durationSeconds: DURATION });
  });

  it.each([
    { button: 'Pause at 30', saved: { reason: 'pause', progressSeconds: 30 } },
    { button: 'Finish', saved: { reason: 'ended', progressSeconds: DURATION } },
  ])('writes through on $button', async ({ button, saved: expected }) => {
    const { saved, press, settled } = await watching();

    await press(button);
    await settled();

    expect(saved).toEqual([{ videoId: VIDEO_ID, durationSeconds: DURATION, ...expected }]);
  });

  it.each([
    { scenario: 'history is paused', options: { handlers: [holds(PAUSED)] } },
    { scenario: 'the viewer is a guest', options: { viewer: undefined } },
  ])('saves nothing while $scenario', async ({ options }) => {
    const { saved, press, settled } = await watching(options);

    for (const button of ['Play to 0', 'Pause at 30', 'Finish']) await press(button);
    await settled();

    expect(saved).toEqual([]);
  });
});
