import type { UserContext } from '@vp/permissions';
import { OWNER_ID, video } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { asViewer } from '#app/__tests__/providers';
import { VideoDetails } from '../video-details';

function renderVideoDetails(
  viewer: UserContext | null,
  overrides: Parameters<typeof video>[0] = {}
): Promise<string> {
  return renderPage(<VideoDetails video={video(overrides)} />, asViewer(viewer));
}

describe('apps/client/web: video details', () => {
  it('titles the video over its likes and description', async () => {
    const markup = await renderVideoDetails(null, {
      title: 'Launch day',
      description: 'All about it',
    });

    expect(markup).toContain('>Launch day</h4>');
    expect(markup).toContain('bi-hand-thumbs-up');
    expect(markup).toContain('All about it');
  });

  it.each<{ scenario: string; viewer: UserContext | null; visible: boolean }>([
    { scenario: 'the owner', viewer: { id: OWNER_ID, role: 'USER' }, visible: true },
    { scenario: 'a guest', viewer: null, visible: false },
    {
      scenario: 'another user',
      viewer: { id: '0190c3a0-5e1d-7000-8000-0000000000ff', role: 'USER' },
      visible: false,
    },
  ])('offers the video actions to $scenario: $visible', async ({ viewer, visible }) => {
    const markup = await renderVideoDetails(viewer);

    expect(markup.includes('video actions')).toBe(visible);
  });
});
