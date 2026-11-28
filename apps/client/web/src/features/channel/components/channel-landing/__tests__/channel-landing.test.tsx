import { createQueryClient } from '@vp/queries';
import { api, CHANNEL_ID, channel } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { channelPageView, contentSection, tabSummary } from '#app/__tests__/channel-page-fixtures';
import { AppProviders, withToasts } from '#app/__tests__/providers';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';
import {
  type ChannelPageArgs,
  channelPageQueryOptions,
} from '#app/lib/query-keys/channel-page-keys';
import { ChannelLanding } from '../channel-landing';

const ARGS: ChannelPageArgs = {
  channelId: CHANNEL_ID,
  slug: undefined,
  locale: 'en',
  viewerId: null,
  preview: null,
};

const SHOWS = tabSummary({ id: 'shows', kind: 'custom', title: 'Shows', slug: 'shows' });

function renderLanding(args: ChannelPageArgs) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(channelQueryOptions(api, CHANNEL_ID).queryKey, channel());
  queryClient.setQueryData(
    channelPageQueryOptions(api, args).queryKey,
    channelPageView(
      { ...SHOWS, sections: [contentSection()] },
      { landing: 'shows', tabs: [tabSummary({ title: 'Start' }), SHOWS] }
    )
  );
  return renderPage(<ChannelLanding args={args} />, withToasts(AppProviders), { queryClient });
}

describe('apps/client/web: ChannelLanding', () => {
  it('links every tab the API listed under its own title and marks the open one', async () => {
    const markup = await renderLanding(ARGS);

    expect(markup).toContain('href="/channels/creator/home"');
    expect(markup).toContain('>Start</a>');
    expect(markup).toMatch(
      /aria-current="page"[^>]*href="\/channels\/creator\/shows"|href="\/channels\/creator\/shows"[^>]*aria-current="page"/
    );
  });

  it('says it is the draft, for which audience, only in a preview', async () => {
    const preview = await renderLanding({ ...ARGS, preview: 'subscriber' });
    const live = await renderLanding(ARGS);

    expect(preview).toContain('Previewing the draft as a subscriber');
    expect(live).not.toContain('Previewing');
  });
});
