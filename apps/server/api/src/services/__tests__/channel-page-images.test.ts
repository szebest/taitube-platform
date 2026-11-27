import { ok } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ChannelPageView } from '@vp/api-contracts';
import { pageImagesOf } from '../channel-page/channel-page-images';

const CHANNEL = '00000000-0000-7000-8000-0000000000c1';
const HEADER = '00000000-0000-7000-8000-0000000000e1';
const INLINE = '00000000-0000-7000-8000-0000000000e2';
const NOT_READY = '00000000-0000-7000-8000-0000000000e3';
const URLS = { w640: 'https://cdn/640.webp', w1280: 'https://cdn/1280.webp' };

const tab = (overrides: Partial<ChannelPageView['tab']>): ChannelPageView['tab'] => ({
  id: 'shows',
  kind: 'custom',
  title: 'Shows',
  slug: 'shows',
  icon: null,
  description: null,
  header: null,
  sections: [],
  ...overrides,
});

describe('pageImagesOf', () => {
  it('answers the ready images a tab header and rich text use, by id, and asks nothing for a tab with none', async () => {
    const repositories = new InMemoryRepositories();
    const findReady = vi.spyOn(repositories.channelImages, 'findReadyImages').mockResolvedValue(
      ok([
        { uploadId: HEADER, urls: URLS },
        { uploadId: INLINE, urls: URLS },
      ])
    );
    const presentation = {
      title: null,
      subtitle: null,
      background: null,
      accent: null,
      density: 'comfortable' as const,
      show: { duration: true, views: true, date: true },
    };

    const images = expectOk(
      await pageImagesOf(
        repositories.channelImages,
        CHANNEL,
        tab({
          header: HEADER,
          sections: [
            {
              kind: 'rich_text',
              id: 'text',
              presentation,
              body: `![Cast](page-image:${INLINE})\n\n![Gone](page-image:${NOT_READY})`,
            },
          ],
        })
      )
    );

    expect(images).toEqual({ [HEADER]: URLS, [INLINE]: URLS });
    expect(findReady).toHaveBeenCalledWith('page-image', CHANNEL, [HEADER, INLINE, NOT_READY]);

    findReady.mockClear();
    expect(expectOk(await pageImagesOf(repositories.channelImages, CHANNEL, tab({})))).toEqual({});
    expect(findReady).not.toHaveBeenCalled();
  });
});
