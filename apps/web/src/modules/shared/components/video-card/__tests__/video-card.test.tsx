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

function renderCard(userContext: Parameters<typeof PermissionsProvider>[0]['userContext']): string {
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
  it('shows the owner the video actions', () => {
    expect(renderCard({ id: OWNER_ID, role: 'USER' })).toContain('video actions');
  });

  it('hides the video actions from another signed-in user', () => {
    expect(
      renderCard({ id: '00000000-0000-7000-8000-0000000000ff', role: 'USER' })
    ).not.toContain('video actions');
  });

  it('hides the video actions from a guest', () => {
    expect(renderCard(null)).not.toContain('video actions');
  });

  it('shows an admin the video actions', () => {
    expect(
      renderCard({ id: '00000000-0000-7000-8000-0000000000aa', role: 'ADMIN' })
    ).toContain('video actions');
  });

  it('renders the poster only when the API supplied one', () => {
    expect(renderCard(null)).not.toContain('<img');
  });
});
