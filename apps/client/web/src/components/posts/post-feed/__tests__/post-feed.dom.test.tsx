import { screen } from '@testing-library/react';
import { NEXT_POST_ID, POLL_POST_ID, post } from '#app/__tests__/post-fixtures';
import { RecordingObserver } from '#app/__tests__/recording-observer';
import { renderPosts } from '#app/__tests__/render-posts';

const COMMUNITY_URL = '/subscriptions/videos?tab=community';

const textPost = (id: string, text: string) => post({ id, body: { kind: 'text', text } });

describe('apps/client/web: PostFeed', () => {
  beforeEach(() => RecordingObserver.install());

  it('lists the posts in the order the API gave them and loads the next page near the end', async () => {
    const calls: string[] = [];
    await renderPosts(COMMUNITY_URL, {
      posts: [
        textPost(NEXT_POST_ID, 'First post'),
        textPost(POLL_POST_ID, 'Second post'),
        textPost('0190c3a0-5e1d-7000-8000-0000000e1005', 'Third post'),
      ],
      pageSize: 2,
      calls,
    });

    expect(await screen.findByText('Second post')).toBeInTheDocument();
    expect(screen.queryByText('Third post')).not.toBeInTheDocument();

    RecordingObserver.enterView();

    expect(await screen.findByText('Third post')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(calls.filter((call) => call.startsWith('GET /v1/feed/community'))).toHaveLength(2);
  });

  it('says so when there is no post', async () => {
    await renderPosts(COMMUNITY_URL, { posts: [] });

    expect(
      await screen.findByText('Posts from the channels you subscribe to show up here')
    ).toBeInTheDocument();
  });
});
