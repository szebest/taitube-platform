# Code shapes

Read before writing one of these shapes. Examples are TypeScript; the shape carries to any
typed language.

## Extend, do not fork

```tsx
// no: a parallel component and a type fork at the call site
{video.status === 'PROCESSING' ? <ProcessingCard video={video} progress={progress} /> : <VideoCard video={video} />}

// yes: one owner takes the variant
<VideoCard video={video} progress={progress} showProgress />
```

The flag and its data are a discriminated union, so passing half of it is a compile error:

```ts
type VideoCardProgressProps =
  | { showProgress: true; progress: number }
  | { showProgress?: false; progress?: never };
```

## One literal discriminant, switched exhaustively

```ts
type Source =
  | { type: 'url'; url: string; poolSize: number }
  | { type: 'client'; client: Client };

function connect(source: Source): Client {
  switch (source.type) {
    case 'url':
      return createClient(source.url, source.poolSize);
    case 'client':
      return source.client;
    default:
      return assertNever(source);
  }
}
```

Never `'url' in source`: a probe breaks silently when a variant grows an overlapping field.

## Registry typed from the source tuple

```ts
export const RENDITIONS = ['1080p', '720p', '480p'] as const;
export type Rendition = (typeof RENDITIONS)[number];

const BITRATE_KBPS: Record<Rendition, number> = {
  '1080p': 5000,
  '720p': 2800,
  '480p': 1400,
};
```

A new case is one tuple entry plus one row; the compiler forces the missing half. A helper
call in place of a literal type widens it and loses the guarantee.

## One source of truth for a value

```ts
const position = index + 1;

logEvent({ position, id: item.id });
recordMetric({ position, id: item.id });
```

Computed once above, passed raw to every consumer; never transformed at each site.

## One signal for many listeners

```ts
const controller = new AbortController();
const { signal } = controller;

window.addEventListener('focus', refetch, { signal });
window.addEventListener('online', refetch, { signal });
document.addEventListener('visibilitychange', refetch, { signal });

return () => {
  controller.abort();
};
```

No stored handler references, one cleanup.

## The name already is the value

```ts
for (const name of names) {
  if (!(name in values)) values[name] = name;
}
```

beats a synthetic `__key0`, a counter and string surgery to rebuild what the name already
said.

## Null means not applicable

`T | null` for "does not apply here", never a `hasX` boolean beside a meaningless object.
The owner returns the fact; the consumer renders or skips it.
