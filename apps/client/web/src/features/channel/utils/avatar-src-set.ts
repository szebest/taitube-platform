import type { Channel } from '@vp/api-contracts';

type Avatar = NonNullable<Channel['avatar']>;

/** The avatar's square files by width, `"url 48w, url 72w, ..."`, smallest first. */
export function avatarSrcSet({ sizes }: Avatar): string {
  return Object.entries(sizes)
    .map(([width, url]) => ({ width: Number(width), url }))
    .toSorted((a, b) => a.width - b.width)
    .map(({ width, url }) => `${url} ${width}w`)
    .join(', ');
}
