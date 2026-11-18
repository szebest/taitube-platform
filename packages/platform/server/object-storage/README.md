# @kit/object-storage

Two pure helpers for an S3-compatible bucket: the `Content-Type` and `Cache-Control` of an object by extension,
and the part size and count of a multipart upload.

```sh
pnpm add @kit/object-storage
```

Tokens and registries: none. Entry points: `getHeaderMapping`, the `HeaderMapping` shape and the per-kind header
constants, `calculatePartSize` and `calculateTotalParts` with their `PartSizeBounds`, and the
`S3_MAX_KEYS_PER_REQUEST` and `MULTIPART_URL_BATCH_SIZE` limits.

```ts
import { getHeaderMapping } from '@kit/object-storage';

const { contentType, cacheControl } = getHeaderMapping('.m3u8');
```
