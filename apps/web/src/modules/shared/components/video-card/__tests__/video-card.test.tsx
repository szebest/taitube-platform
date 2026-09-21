import type { VideoSummary } from '@vp/api-contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ApiProvider } from '@reduxjs/toolkit/dist/query/react';
import { baseApi } from '../../../../../base-api';
import { PermissionsProvider } from '../../../providers/permissions-provider';
import { VideoCard } from '../video-card';

const OWNER_ID = '00000000-0000-7000-8000-000000000002';

const video: VideoSummary = {
  id: '00000000-0000-7000-8000-000000000001',
  ownerId: OWNER_ID,
  title: 'A video',
  description: 'About something',
  visibility: 'public',
  status: 'READY',
  viewsCount: 12,
  version: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

type Viewer = Parameters<typeof PermissionsProvider>[0]['userContext'];

function renderCard(userContext: Viewer): string {
  return renderToStaticMarkup(
    <ApiProvider api={baseApi}>
      <PermissionsProvider userContext={userContext}>
        <MemoryRouter>
          <VideoCard video={video} />
        </MemoryRouter>
      </PermissionsProvider>
    </ApiProvider>
  );
}

describe('apps/web: video card', () => {
  it.each<{ scenario: string; userContext: Viewer; visible: boolean }>([
    { scenario: 'the owner', userContext: { id: OWNER_ID, role: 'USER' }, visible: true },
    {
      scenario: 'another signed-in user',
      userContext: { id: '00000000-0000-7000-8000-0000000000ff', role: 'USER' },
      visible: false,
    },
    { scenario: 'a guest', userContext: null, visible: false },
    {
      scenario: 'an admin',
      userContext: { id: '00000000-0000-7000-8000-0000000000aa', role: 'ADMIN' },
      visible: true,
    },
  ])('shows the video actions to $scenario: $visible', ({ userContext, visible }) => {
    const markup = renderCard(userContext);

    expect(markup.includes('video actions')).toBe(visible);
  });

  it('renders the poster only when the API supplied one', () => {
    expect(renderCard(null)).not.toContain('<img');
  });
});
