import type { UserContext } from '@vp/permissions';
import { OWNER_ID, video } from '../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../__tests__/render-page';
import { VideoDetails } from '../video-details';

describe('apps/web: video details', () => {
  it('titles the video over its likes and description', () => {
    const markup = renderPage(<VideoDetails video={video({ title: 'Launch day', description: 'All about it' })} />, {
      viewer: null,
    });

    expect(markup).toContain('>Launch day</h4>');
    expect(markup).toContain('bi-hand-thumbs-up');
    expect(markup).toContain('All about it');
  });

  it.each<{ scenario: string; viewer: UserContext | null; visible: boolean }>([
    { scenario: 'the owner', viewer: { id: OWNER_ID, role: 'USER' }, visible: true },
    { scenario: 'a guest', viewer: null, visible: false },
    { scenario: 'another user', viewer: { id: '0190c3a0-5e1d-7000-8000-0000000000ff', role: 'USER' }, visible: false },
  ])('offers the video actions to $scenario: $visible', ({ viewer, visible }) => {
    const markup = renderPage(<VideoDetails video={video()} />, { viewer });

    expect(markup.includes('video actions')).toBe(visible);
  });
});
