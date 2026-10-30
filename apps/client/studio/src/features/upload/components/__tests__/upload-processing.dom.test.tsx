import { screen, within } from '@testing-library/react';
import { videoKeys } from '@vp/queries';
import { VIDEO_ID, video } from '@vp/web-testing';
import { act } from 'react';

import { renderStudio, serveUpload, uploadClip } from '#app/features/upload/__tests__/upload-api.fixture';

async function sendClip() {
  const { finishTransfer } = serveUpload();
  const rendered = await renderStudio();
  await uploadClip(rendered.user, 'Harbour');
  await screen.findByRole('progressbar', { name: 'Upload progress of Harbour' });
  finishTransfer();
  await screen.findByRole('progressbar', { name: 'Overall of Harbour' });
  return rendered;
}

describe('apps/client/studio: UploadProcessing', () => {
  it('shows the status and the progress of each rendition and the thumbnail as the stream patches them', async () => {
    const { queryClient } = await sendClip();

    act(() =>
      queryClient.setQueryData(
        videoKeys.detail(VIDEO_ID),
        video({
          status: 'PROCESSING',
          progress: { overall: 40, byRendition: { '720p': 60, '480p': 20, '-': 100 } },
        })
      )
    );

    const bar = (name: string) => screen.getByRole('progressbar', { name: `${name} of Harbour` });
    await vi.waitFor(() => expect(bar('Overall')).toHaveAttribute('aria-valuenow', '40'));
    expect(bar('720p')).toHaveAttribute('aria-valuenow', '60');
    expect(bar('480p')).toHaveAttribute('aria-valuenow', '20');
    expect(bar('Thumbnail')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('links to the editor, and to the viewer app once the video is ready', async () => {
    const { queryClient } = await sendClip();
    const panel = within(await screen.findByRole('complementary', { name: 'Uploads' }));
    expect(panel.queryByRole('link', { name: 'Watch on Taitube' })).not.toBeInTheDocument();

    act(() => queryClient.setQueryData(videoKeys.detail(VIDEO_ID), video({ status: 'READY' })));

    expect(await panel.findByRole('link', { name: 'Watch on Taitube' })).toHaveAttribute(
      'href',
      `http://localhost:5173/watch/${VIDEO_ID}`
    );
    expect(panel.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/videos/${VIDEO_ID}/edit`
    );
  });
});
