import { screen } from '@testing-library/react';
import { VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { serveEditor } from '#app/features/videos/__tests__/edit-api.fixture';
import {
  creatorScreening,
  serveScreening,
} from '#app/features/videos/__tests__/screening-api.fixture';
import { getRouter } from '#app/router';

const open = (status: 'HELD' | 'REJECTED' | 'READY', screening = creatorScreening({ status })) => {
  serveEditor(video({ status }));
  const served = serveScreening(screening);
  return renderRoute(getRouter, `/videos/${VIDEO_ID}/edit`, { handlers: [signInBrowser()] }).then(
    (rendered) => ({ ...rendered, ...served })
  );
};

describe('apps/client/studio: VideoScreeningPanel', () => {
  it('tells the owner a video is on hold with a plain reason and nothing about what it matched', async () => {
    await open('HELD');

    const panel = await screen.findByRole('region', { name: 'This video is on hold' });

    expect(panel).toHaveTextContent('It looks like a copy of a video that is already on Taitube.');
    expect(panel).toHaveTextContent('A reviewer has to look at it before it can be published.');
    expect(screen.queryByRole('textbox', { name: 'Why is this a mistake?' })).toBeNull();
  });

  it.each([
    { reason: 'NSFW', text: 'It looks like it contains explicit content.' },
    { reason: 'BLANK', text: 'It looks blank or frozen.' },
    { reason: 'METADATA_SPAM', text: 'Its title, description or tags look like spam.' },
    { reason: 'SCREEN_ERROR', text: 'The automatic check could not finish.' },
  ] as const)('words the reason $reason', async ({ reason, text }) => {
    await open('HELD', creatorScreening({ reasons: [reason] }));

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('shows a rejection with the reviewer note and the appeal form', async () => {
    await open(
      'REJECTED',
      creatorScreening({
        status: 'REJECTED',
        decision: 'rejected',
        decisionNote: 'A copy of another upload',
        canAppeal: true,
      })
    );

    const panel = await screen.findByRole('region', { name: 'A reviewer rejected this video' });

    expect(panel).toHaveTextContent('The reviewer wrote: A copy of another upload');
    expect(screen.getByRole('textbox', { name: 'Why is this a mistake?' })).toBeInTheDocument();
  });

  it('shows the appeal sent and that a different reviewer decides it, with no form', async () => {
    await open(
      'HELD',
      creatorScreening({
        appeal: { message: 'It is mine', createdAt: '2026-10-03T00:00:00.000Z', resolved: false },
      })
    );

    expect(await screen.findByText('Your appeal: It is mine')).toBeInTheDocument();
    expect(screen.getByText('A different reviewer will decide it.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Why is this a mistake?' })).toBeNull();
  });

  it('offers no appeal for a takedown by a moderator and shows nothing about it', async () => {
    await open('REJECTED', creatorScreening({ status: 'REJECTED', decision: null }));
    await screen.findByRole('button', { name: 'Save changes' });

    expect(screen.queryByRole('region', { name: /reviewer rejected/ })).toBeNull();
  });

  it('shows nothing for a video that is not held or rejected', async () => {
    await open('READY');
    await screen.findByRole('button', { name: 'Save changes' });

    expect(screen.queryByRole('region', { name: 'This video is on hold' })).toBeNull();
  });
});
