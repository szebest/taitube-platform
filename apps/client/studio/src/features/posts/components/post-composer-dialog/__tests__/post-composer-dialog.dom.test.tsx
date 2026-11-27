import { fireEvent, screen, waitFor } from '@testing-library/react';
import { creatorVideo } from '#app/__tests__/creator-video.fixture';
import { PLAYLIST_ID } from '#app/features/posts/__tests__/posts-api.fixture';
import { renderPosts } from '#app/features/posts/__tests__/render-posts';
import { openComposer, submit } from './composer-dialog-steps';

describe('apps/client/studio: PostComposerDialog', () => {
  it('publishes a text post with exactly the contract body, counting as it is typed', async () => {
    const rendered = await renderPosts();
    await openComposer(rendered);

    await rendered.user.type(
      screen.getByRole('textbox', { name: /What do you want to say/ }),
      '  Hello  '
    );
    expect(screen.getByText('9 of 2,000')).toBeInTheDocument();
    await submit(rendered.user, 'Publish');

    await waitFor(() => expect(rendered.requests.created).toHaveLength(1));
    expect(rendered.requests.created[0]).toEqual({
      payload: { kind: 'text', text: 'Hello' },
      commentsEnabled: true,
      timing: { mode: 'now' },
    });
    expect(await screen.findByText('Post published')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('names what is wrong once the creator tries, and sends nothing', async () => {
    const rendered = await renderPosts();
    await openComposer(rendered);

    await submit(rendered.user, 'Publish');

    expect(await screen.findByRole('alert')).toHaveTextContent('text');
    expect(rendered.requests.created).toEqual([]);

    await rendered.user.type(
      screen.getByRole('textbox', { name: /What do you want to say/ }),
      'Hi'
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends a poll with its question, options and replies off', async () => {
    const rendered = await renderPosts();
    await openComposer(rendered);

    await rendered.user.click(screen.getByRole('tab', { name: 'Poll' }));
    await rendered.user.type(screen.getByRole('textbox', { name: /Question/ }), 'Which?');
    await rendered.user.type(screen.getByRole('textbox', { name: 'Option 1' }), 'Tea');
    await rendered.user.type(screen.getByRole('textbox', { name: 'Option 2' }), 'Coffee');
    await rendered.user.click(screen.getByRole('switch', { name: 'Let viewers reply' }));
    await submit(rendered.user, 'Publish');

    await waitFor(() => expect(rendered.requests.created).toHaveLength(1));
    expect(rendered.requests.created[0]).toEqual({
      payload: { kind: 'poll', question: 'Which?', options: ['Tea', 'Coffee'], closesAt: null },
      commentsEnabled: false,
      timing: { mode: 'now' },
    });
  });

  it('sends a quiz with its right answer and explanation', async () => {
    const rendered = await renderPosts();
    await openComposer(rendered);

    await rendered.user.click(screen.getByRole('tab', { name: 'Quiz' }));
    await rendered.user.type(screen.getByRole('textbox', { name: /Question/ }), 'Which?');
    await rendered.user.type(screen.getByRole('textbox', { name: 'Option 1' }), 'Tea');
    await rendered.user.type(screen.getByRole('textbox', { name: 'Option 2' }), 'Coffee');
    await rendered.user.click(screen.getByRole('radio', { name: 'Option 2 is the right answer' }));
    await rendered.user.type(screen.getByRole('textbox', { name: /Explanation/ }), 'Beans');
    await submit(rendered.user, 'Publish');

    await waitFor(() => expect(rendered.requests.created).toHaveLength(1));
    expect(rendered.requests.created[0]).toMatchObject({
      payload: {
        kind: 'quiz',
        question: 'Which?',
        options: ['Tea', 'Coffee'],
        closesAt: null,
        correctIndex: 1,
        explanation: 'Beans',
      },
    });
  });

  it('keeps a draft without asking for a time', async () => {
    const rendered = await renderPosts();
    await openComposer(rendered);

    await rendered.user.type(
      screen.getByRole('textbox', { name: /What do you want to say/ }),
      'Later'
    );
    await rendered.user.click(screen.getByRole('radio', { name: 'Save as draft' }));
    await submit(rendered.user, 'Save draft');

    await waitFor(() => expect(rendered.requests.created).toHaveLength(1));
    expect(rendered.requests.created[0]).toMatchObject({ timing: { mode: 'draft' } });
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
  });

  it.each([
    { scenario: 'no time', date: '', time: '', says: 'Pick the date and the time to publish at.' },
    {
      scenario: 'a time in the past',
      date: '2020-01-01',
      time: '10:00',
      says: 'Pick a time in the future.',
    },
  ])('refuses a schedule with $scenario', async ({ date, time, says }) => {
    const rendered = await renderPosts();
    await openComposer(rendered);

    await rendered.user.type(
      screen.getByRole('textbox', { name: /What do you want to say/ }),
      'Soon'
    );
    await rendered.user.click(screen.getByRole('radio', { name: 'Schedule' }));
    if (date) fireEvent.change(screen.getByLabelText(/Publish at/), { target: { value: date } });
    if (time) fireEvent.change(screen.getByLabelText('Time'), { target: { value: time } });
    await submit(rendered.user, 'Schedule');

    expect(await screen.findByRole('alert')).toHaveTextContent(says);
    expect(rendered.requests.created).toEqual([]);
  });

  it('schedules a post for a time in the future', async () => {
    const rendered = await renderPosts();
    await openComposer(rendered);

    await rendered.user.type(
      screen.getByRole('textbox', { name: /What do you want to say/ }),
      'Soon'
    );
    await rendered.user.click(screen.getByRole('radio', { name: 'Schedule' }));
    fireEvent.change(screen.getByLabelText(/Publish at/), { target: { value: '2099-01-01' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '10:00' } });
    await submit(rendered.user, 'Schedule');

    await waitFor(() => expect(rendered.requests.created).toHaveLength(1));
    expect(rendered.requests.created[0]).toMatchObject({
      timing: { mode: 'schedule', publishAt: new Date('2099-01-01T10:00').toISOString() },
    });
  });

  it('shares a chosen video at a second of it', async () => {
    const rendered = await renderPosts('/posts', {
      videos: [creatorVideo({ title: 'City tour', durationMs: 600_000 })],
    });
    await openComposer(rendered);

    await rendered.user.click(screen.getByRole('tab', { name: 'Video' }));
    await rendered.user.click(screen.getByRole('button', { name: 'Choose' }));
    await rendered.user.click(await screen.findByRole('option', { name: 'City tour' }));
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Start time' }), { key: 'ArrowRight' });
    await rendered.user.type(screen.getByRole('textbox', { name: /Your comment/ }), 'Watch');
    await submit(rendered.user, 'Publish');

    await waitFor(() => expect(rendered.requests.created).toHaveLength(1));
    expect(rendered.requests.created[0]).toMatchObject({
      payload: { kind: 'video_share', comment: 'Watch', startMs: 1000 },
    });
  });

  it('shares a public playlist and leaves the private ones out', async () => {
    const rendered = await renderPosts();
    await openComposer(rendered);

    await rendered.user.click(screen.getByRole('tab', { name: 'Playlist' }));
    await rendered.user.click(screen.getByRole('button', { name: 'Choose' }));
    expect(screen.queryByRole('option', { name: 'Private list' })).toBeNull();
    await rendered.user.click(await screen.findByRole('option', { name: 'Best of' }));
    await submit(rendered.user, 'Publish');

    await waitFor(() => expect(rendered.requests.created).toHaveLength(1));
    expect(rendered.requests.created[0]).toMatchObject({
      payload: { kind: 'playlist_share', playlistId: PLAYLIST_ID, comment: null },
    });
  });
});
