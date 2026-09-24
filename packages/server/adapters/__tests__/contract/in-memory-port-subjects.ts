import { expectOk } from '@vp/testing/result';
import { LazyQueueRegistry } from '../../composition/queue-registry';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import { InMemoryFlowProducer } from '../../in-memory/in-memory-flow-producer';
import { InMemoryJobQueue } from '../../in-memory/in-memory-job-queue';
import { InMemoryMultipartStorage } from '../../in-memory/in-memory-multipart-storage';
import { InMemoryStorageClient } from '../../in-memory/in-memory-storage-client';
import type { CacheClientSubject } from './cache-client.contract';
import type { FlowProducerSubject } from './flow-producer.contract';
import type { JobQueueSubject } from './job-queue.contract';
import type { MultipartStorageSubject } from './multipart-storage.contract';
import type { StorageClientSubject } from './storage-client.contract';

export async function inMemoryJobQueueSubject(name: string): Promise<JobQueueSubject> {
  const queue = new InMemoryJobQueue(name);
  return {
    queue,
    close: async () => {
      await queue.close();
    },
  };
}

export async function inMemoryFlowProducerSubject(): Promise<FlowProducerSubject> {
  const queues = new LazyQueueRegistry((name) => new InMemoryJobQueue(name));
  return {
    producer: new InMemoryFlowProducer((name) => queues.get(name)),
    queue: (name) => queues.get(name),
    close: async () => {
      await queues.close();
    },
  };
}

export async function inMemoryCacheClientSubject(): Promise<CacheClientSubject> {
  const cache = new InMemoryCacheClient();
  return {
    cache,
    close: async () => {
      expectOk(await cache.close());
    },
  };
}

const LOCAL_BUCKET = 'contract';

export async function inMemoryStorageClientSubject(): Promise<StorageClientSubject> {
  const storage = new InMemoryStorageClient();
  return {
    storage,
    bucket: LOCAL_BUCKET,
    close: async () => {
      expectOk(await storage.close());
    },
  };
}

export async function inMemoryMultipartStorageSubject(): Promise<MultipartStorageSubject> {
  const storage = new InMemoryStorageClient();
  const multipart = new InMemoryMultipartStorage(storage);
  return {
    multipart,
    storage,
    bucket: LOCAL_BUCKET,
    putPart: async (_key, uploadId, partNumber, data) => {
      expectOk(multipart.seedPart(uploadId, partNumber, data));
    },
    close: async () => {
      expectOk(await multipart.close());
    },
  };
}
