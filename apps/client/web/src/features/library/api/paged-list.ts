import type { InfiniteData } from '@tanstack/react-query';

export interface Page<TItem> {
  items: TItem[];
  nextCursor: string | null;
}

export function dropItems<TPage extends Page<unknown>>(
  data: InfiniteData<TPage>,
  drop: (item: TPage['items'][number]) => boolean
): InfiniteData<TPage> {
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.filter((item) => !drop(item)) })),
  };
}

export function emptyPages<TPage extends Page<unknown>>(
  data: InfiniteData<TPage>
): InfiniteData<TPage> {
  const [first] = data.pages;
  if (!first) return data;
  return { pages: [{ ...first, items: [], nextCursor: null }], pageParams: [undefined] };
}
