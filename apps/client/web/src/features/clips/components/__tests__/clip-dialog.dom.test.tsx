import { screen, within } from '@testing-library/react';
import { createClip } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { account, CLIP_ID, clip, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => {
  const { StubPlayer } = await import('#app/features/watch/__tests__/stub-player');
  return { ...(await importOriginal()), TaitubePlayer: StubPlayer, TaitubePreview: StubPlayer };
});

const SPRITE = {
  url: 'http://localhost:9000/sprites/s.jpg',
  intervalSec: 10,
  columns: 10,
  tileWidth: 160,
  tileHeight: 90,
};

async function openClipDialog(handlers: Parameters<typeof renderWatch>[0] = {}) {
  const rendered = await renderWatch({
    viewer: account(),
    video: { durationMs: 120_000, sprite: SPRITE },
    ...handlers,
  });
  await rendered.user.click(screen.getByRole('button', { name: 'Clip' }));
  return { ...rendered, dialog: await screen.findByRole('dialog', { name: 'Clip this video' }) };
}

const savingClip = (answer: () => Response | Promise<Response>) => mockEndpoint(createClip, answer);

describe('apps/client/web: clip dialog', () => {
  it('opens on twenty seconds from the playhead, previewed and summed up', async () => {
    const { dialog } = await openClipDialog();

    expect(within(dialog).getByText('01:15 to 01:35, 00:20 long')).toBeInTheDocument();
    expect(await within(dialog).findByTestId('player')).toHaveAttribute(
      'data-range',
      '75000-95000'
    );
    expect(within(dialog).getByRole('slider', { name: 'Clip start' })).toHaveAttribute(
      'aria-valuenow',
      '75'
    );
    expect(within(dialog).getByRole('slider', { name: 'Clip end' })).toHaveAttribute(
      'aria-valuenow',
      '95'
    );
  });

  it('moves the range with the keyboard and keeps it playing in the preview', async () => {
    const { user, dialog } = await openClipDialog();

    within(dialog).getByRole('slider', { name: 'Clip end' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(within(dialog).getByText('01:15 to 01:36, 00:21 long')).toBeInTheDocument();
    expect(await within(dialog).findByTestId('player')).toHaveAttribute(
      'data-range',
      '75000-96000'
    );
  });

  it.each([
    {
      scenario: 'past the end of the video',
      key: '{PageUp}',
      times: 5,
      summary: '01:15 to 02:00, 00:45 long',
    },
    {
      scenario: 'under five seconds',
      key: '{PageDown}',
      times: 2,
      summary: '01:15 to 01:25, 00:10 long',
    },
  ])(
    'stops the end thumb at the last valid place when it is pushed $scenario',
    async ({ key, times, summary }) => {
      const { user, dialog } = await openClipDialog();

      within(dialog).getByRole('slider', { name: 'Clip end' }).focus();
      await user.keyboard(key.repeat(times));

      expect(within(dialog).getByText(summary)).toBeInTheDocument();
    }
  );

  it('saves the range with the title, copies the link, says so and closes', async () => {
    const saved: unknown[] = [];
    const { user, dialog } = await openClipDialog({
      handlers: [
        mockEndpoint(createClip, async ({ params, request }) => {
          saved.push([params.id, await request.json()]);
          return HttpResponse.json(clip(), { status: 201 });
        }),
      ],
    });

    const title = within(dialog).getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'My clip');
    await user.click(within(dialog).getByRole('button', { name: 'Save clip' }));

    expect(await screen.findByText('Clip saved, link copied')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(`http://localhost:3000/clip/${CLIP_ID}`);
    expect(saved).toContainEqual([VIDEO_ID, { startMs: 75_000, endMs: 95_000, title: 'My clip' }]);
    expect(screen.queryByRole('dialog', { name: 'Clip this video' })).not.toBeInTheDocument();
  });

  it('says so when the clip is saved but its link cannot be copied', async () => {
    const { user, dialog } = await openClipDialog({
      handlers: [savingClip(() => HttpResponse.json(clip(), { status: 201 }))],
    });
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    await user.click(within(dialog).getByRole('button', { name: 'Save clip' }));

    expect(
      await screen.findByText('Clip saved, but the link could not be copied')
    ).toBeInTheDocument();
  });

  it('says so and stays open when the API refuses the clip', async () => {
    const { user, dialog } = await openClipDialog({
      handlers: [savingClip(() => problemReply(ErrorCodes.VALIDATION_FAILED))],
    });

    await user.click(within(dialog).getByRole('button', { name: 'Save clip' }));

    expect(await screen.findByText('Your clip could not be saved')).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
  });

  it.each([
    { title: '', error: true },
    { title: 'x'.repeat(101), error: true },
    { title: 'Fine', error: false },
  ])('answers the title "$title" with an error: $error', async ({ title, error }) => {
    const { user, dialog } = await openClipDialog();
    const field = within(dialog).getByRole('textbox', { name: 'Title' });

    await user.clear(field);
    if (title) {
      await user.click(field);
      await user.paste(title);
    }
    await user.tab();

    expect(
      within(dialog).queryByText('Give the clip a title of 1 to 100 characters') !== null
    ).toBe(error);
    expect(within(dialog).getByRole('button', { name: 'Save clip' }).hasAttribute('disabled')).toBe(
      error
    );
  });
});
