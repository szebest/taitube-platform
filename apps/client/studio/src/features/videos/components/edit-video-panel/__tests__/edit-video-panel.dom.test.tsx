import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { renderEditVideo } from '#app/features/videos/__tests__/render-edit-video';
import { generationsOf } from '#app/features/videos/__tests__/video-pipeline-api.fixture';

const generation = (patch: Partial<ReturnType<typeof generationsOf>['items'][number]>) => ({
  generation: 2,
  kind: 'replacement' as const,
  status: 'active' as const,
  durationMs: 120_000,
  needsReview: false,
  errorCode: null,
  purgeAfter: null,
  createdAt: '2026-03-01T12:00:00.000Z',
  ...patch,
});

describe('apps/client/studio: EditVideoPanel', () => {
  it.each([
    {
      shape: 'a replacement rendering',
      items: [generation({ status: 'rendering' })],
      says: 'A new version is being prepared. The current one keeps playing until it is ready.',
    },
    {
      shape: 'the last change failing',
      items: [generation({ status: 'failed', errorCode: 'UNSUPPORTED_CODEC' })],
      says: 'The last change could not be processed, so the video was left as it was.',
    },
    {
      shape: 'a replacement of another length playing',
      items: [generation({ needsReview: true })],
      says: 'The new file is a different length. Check the chapters, corrections and captions.',
    },
  ])('says so over $shape', async ({ items, says }) => {
    await renderEditVideo({ generations: generationsOf({ activeGeneration: 2, items }) });

    expect(await screen.findByText(says)).toBeInTheDocument();
  });

  it('keeps every save closed while a change is in flight', async () => {
    await renderEditVideo({
      generations: generationsOf({ items: [generation({ status: 'uploading' })] }),
    });

    expect(await screen.findByRole('button', { name: 'Save and render' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeDisabled();
  });

  it('meets the accessibility bar', async () => {
    await renderEditVideo();
    await screen.findByRole('heading', { name: 'Trim and blur' });

    expect(await axeViolations()).toEqual([]);
  });
});
