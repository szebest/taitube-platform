import { type Result, map, ok } from '@kit/result';
import type { ChannelPageView } from '@vp/api-contracts';
import type { ChannelImageRepositoryPort } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { richTextImageIds, richTextTree } from '@vp/validation';

type PageTab = ChannelPageView['tab'];

function idsOfTab({ header, sections }: PageTab): string[] {
  const ids = header ? [header] : [];
  for (const section of sections) {
    if (section.presentation.background) ids.push(section.presentation.background);
    if (section.kind === 'rich_text') ids.push(...richTextImageIds(richTextTree(section.body)));
  }
  return [...new Set(ids)];
}

export async function pageImagesOf(
  images: Pick<ChannelImageRepositoryPort, 'findReadyImages'>,
  channelId: string,
  tab: PageTab
): Promise<Result<ChannelPageView['images'], DatabaseUnavailable>> {
  const ids = idsOfTab(tab);
  if (ids.length === 0) return ok({});
  const ready = await images.findReadyImages('page-image', channelId, ids);
  return map(ready, (found) =>
    Object.fromEntries(found.map(({ uploadId, urls }) => [uploadId, urls]))
  );
}
