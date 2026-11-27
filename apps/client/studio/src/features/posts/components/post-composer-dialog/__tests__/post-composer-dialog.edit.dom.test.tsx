import { screen, waitFor, within } from '@testing-library/react';
import { ErrorCodes } from '@vp/errors';
import { managedPost, POST_ID } from '#app/features/posts/__tests__/posts-api.fixture';
import { renderPosts } from '#app/features/posts/__tests__/render-posts';
import { openComposer, submit } from './composer-dialog-steps';

const poll = (patch = {}) =>
  managedPost(
    {
      kind: 'poll',
      question: 'Next topic?',
      options: [
        { text: 'Lighting', votes: 0 },
        { text: 'Audio', votes: 0 },
      ],
      closesAt: null,
      closed: false,
      votedIndex: null,
      totalVotes: 0,
    },
    patch
  );

describe('apps/client/studio: PostComposerDialog, editing', () => {
  it('edits a post against its version, with the kind and the schedule left alone', async () => {
    const rendered = await renderPosts('/posts', {
      posts: [managedPost(undefined, { version: 4 })],
    });

    await rendered.user.click(screen.getByRole('button', { name: /Actions for/ }));
    await rendered.user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit post' });
    expect(within(dialog).getByRole('textbox', { name: /What do you want to say/ })).toHaveValue(
      'Hello from the studio'
    );
    expect(within(dialog).getByRole('tab', { name: 'Poll' })).toBeDisabled();
    expect(within(dialog).queryByRole('radio', { name: 'Schedule' })).toBeNull();
    await rendered.user.type(
      within(dialog).getByRole('textbox', { name: /What do you want to say/ }),
      '!'
    );
    await submit(rendered.user, 'Save changes');

    await waitFor(() => expect(rendered.requests.updated).toHaveLength(1));
    expect(rendered.requests.updated[0]).toEqual({
      id: POST_ID,
      body: {
        payload: { kind: 'text', text: 'Hello from the studio!' },
        commentsEnabled: true,
        timing: { mode: 'now' },
        version: 4,
      },
    });
  });

  it('locks a poll that has votes, and says so', async () => {
    const rendered = await renderPosts('/posts', {
      posts: [
        poll({
          body: {
            kind: 'poll',
            question: 'Next topic?',
            options: [
              { text: 'Lighting', votes: 2 },
              { text: 'Audio', votes: 1 },
            ],
            closesAt: null,
            closed: false,
            votedIndex: null,
            totalVotes: 3,
          },
        }),
      ],
    });

    await rendered.user.click(screen.getByRole('button', { name: /Actions for/ }));
    await rendered.user.click(await screen.findByRole('menuitem', { name: 'Edit' }));

    expect(await screen.findByText('Voting has started')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Question/ })).toBeDisabled();
  });

  it('offers to reload or overwrite when the post moved on, and overwrites on the newest version', async () => {
    const rendered = await renderPosts('/posts', {
      posts: [managedPost(undefined, { version: 4 })],
      failure: ErrorCodes.VERSION_CONFLICT,
    });

    await rendered.user.click(screen.getByRole('button', { name: /Actions for/ }));
    await rendered.user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    rendered.state.posts = [managedPost(undefined, { version: 5 })];
    await submit(rendered.user, 'Save changes');

    expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
    rendered.state.failure = undefined;
    await rendered.user.click(screen.getByRole('button', { name: 'Overwrite' }));

    await waitFor(() => expect(rendered.requests.updated).toHaveLength(2));
    expect(rendered.requests.updated.map(({ body }) => body)).toMatchObject([
      { version: 4 },
      { version: 5 },
    ]);
  });

  it('says when a post could not be saved', async () => {
    const rendered = await renderPosts('/posts', { failure: ErrorCodes.POST_DAILY_LIMIT });
    await openComposer(rendered);

    await rendered.user.type(
      screen.getByRole('textbox', { name: /What do you want to say/ }),
      'Hi'
    );
    await submit(rendered.user, 'Publish');

    expect(await screen.findByText('The post was not saved.')).toBeInTheDocument();
  });
});
