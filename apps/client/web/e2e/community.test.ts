import { expect, test } from '../../../../tests/playwright/fixtures';

test.describe('community', () => {
  test.describe.configure({ mode: 'serial' });

  test('a creator publishes a poll and a subscriber votes once on the channel page', async ({
    page,
    api,
    signIn,
  }) => {
    const creator = await api('creator');
    const account = (await (await creator.get('/v1/me/account')).json()) as {
      channel: { id: string };
    };
    const published = await creator.post('/v1/me/channel/posts', {
      data: {
        payload: {
          kind: 'poll',
          question: 'Which route next?',
          options: ['Line 28', 'Line 15'],
          closesAt: null,
        },
        commentsEnabled: true,
      },
    });
    expect(published.status()).toBe(201);
    const viewer = await api('viewer');
    await viewer.put(`/v1/channels/${account.channel.id}/subscription`);

    await signIn('viewer');
    await page.goto(`/channel/${account.channel.id}?tab=posts`);
    const poll = page.getByText('Which route next?');
    await expect(poll).toBeVisible();
    await page.getByRole('button', { name: 'Line 28' }).click();

    await expect(page.getByText(/votes?/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Line 15' })).toHaveCount(0);
  });

  test('a viewer starts a thread and its marker appears after two replies from two viewers', async ({
    page,
    api,
    signIn,
    stack,
  }) => {
    const { watchable } = stack.videos;
    const viewer = await api('viewer');
    const started = await viewer.post(`/v1/videos/${watchable.id}/threads`, {
      data: { anchorMs: 0, title: 'The first shot', body: '' },
    });
    expect(started.status()).toBe(201);
    const { id } = (await started.json()) as { id: string };
    await viewer.post(`/v1/threads/${id}/comments`, { data: { content: 'Same here' } });
    const other = await api('stranger');
    await other.post(`/v1/threads/${id}/comments`, { data: { content: 'Me too' } });

    const listed = await (await viewer.get(`/v1/videos/${watchable.id}/threads`)).json();
    expect((listed as { markers: unknown[] }).markers).toHaveLength(1);

    await signIn('viewer');
    await page.goto(`/watch/${watchable.id}`);
    await page.getByRole('tab', { name: 'Threads' }).click();
    await expect(page.getByText('The first shot')).toBeVisible();
    await expect(page.getByRole('button', { name: /The first shot/ }).first()).toBeVisible();
  });
});
