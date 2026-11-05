import type { StorageClient } from '@vp/core/ports';
import type { StorageUnavailable } from '@vp/errors';
import { isErr, map, ok, type Result } from '@vp/result';
import type { HeaderMapping } from '@vp/storage';

type Write = () => Promise<Result<void, StorageUnavailable>>;

/**
 * Writes a broadcast's objects one after another, in the order they were asked for, so a playlist is
 * never stored before the parts it lists. The first failed write stops every write queued after it.
 */
export class LiveUploader {
  private tail: Promise<Result<void, StorageUnavailable>> = Promise.resolve(ok());
  private readonly failed = new AbortController();
  /** Aborts at the first failed write, so the encoder feeding this uploader can stop with it. */
  readonly signal: AbortSignal = this.failed.signal;

  constructor(
    private readonly storage: StorageClient,
    private readonly bucket: string
  ) {}

  async put(
    key: string,
    body: Uint8Array | string,
    headers: HeaderMapping
  ): Promise<Result<void, StorageUnavailable>> {
    const uploaded = await this.storage.uploadObject({
      bucket: this.bucket,
      key,
      body,
      ...headers,
    });
    return map(uploaded, () => undefined);
  }

  enqueue(write: Write): void {
    this.tail = this.tail.then(async (previous) => {
      if (isErr(previous)) return previous;
      const written = await write();
      if (isErr(written)) this.failed.abort();
      return written;
    });
  }

  /** Settles once every queued write has, with the first failure if there was one. */
  drained(): Promise<Result<void, StorageUnavailable>> {
    return this.tail;
  }
}
