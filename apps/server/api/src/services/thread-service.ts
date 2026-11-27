import { type Result, err, isErr, ok } from '@kit/result';
import type { ThreadBody, ThreadListView, ThreadView, RemoveThreadBody } from '@vp/api-contracts';
import type { ActingChannel } from '@vp/domain';
import { THREAD_LIST_LIMIT } from '@vp/domain';
import {
  type ReadThreadFailure,
  type ReadVideoFailure,
  decideThreadRead,
  publicReadFailure,
  threadNotFound,
  type ThreadNotFound,
} from '@vp/domain-rules';
import { decideVideoRead, type VideoNotFound } from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import {
  type ThreadCreateDeps,
  type CreateThreadServiceFailure,
  createThread,
} from './thread-create';
import {
  type PinThreadServiceFailure,
  type RemoveThreadServiceFailure,
  type ThreadManageDeps,
  removeThread,
  setThreadPinned,
} from './thread-manage';
import { toThreadListView, toThreadView } from './thread-views';

export type ThreadServiceDeps = ThreadCreateDeps & ThreadManageDeps;

type ReadFailure = ReadVideoFailure | ThreadNotFound | DatabaseUnavailable;

/** A reader refused the video is told what its own page tells them; a thread out of reach is not there. */
function disguised(failure: ReadThreadFailure) {
  return failure.code === ErrorCodes.THREAD_NOT_FOUND ? failure : publicReadFailure(failure);
}

export class ThreadService {
  constructor(private readonly deps: ThreadServiceDeps) {}

  async list(
    viewer: UserContext | null,
    videoId: string
  ): Promise<Result<ThreadListView, ReadVideoFailure | VideoNotFound | DatabaseUnavailable>> {
    const video = await this.deps.videos.findById(videoId);
    if (isErr(video)) return video;
    const readable = decideVideoRead({ viewer, video: video.value, videoId });
    if (isErr(readable)) return err(publicReadFailure(readable.error));

    const entries = await this.deps.threads.listByVideo(videoId, {
      viewer: viewer && { id: viewer.id },
      limit: THREAD_LIST_LIMIT,
    });
    return isErr(entries) ? entries : ok(toThreadListView(entries.value, readable.value, viewer));
  }

  async get(
    viewer: UserContext | null,
    threadId: string
  ): Promise<Result<ThreadView, ReadFailure>> {
    const entry = await this.deps.threads.findEntry(threadId);
    if (isErr(entry)) return entry;
    const video = entry.value
      ? await this.deps.videos.findById(entry.value.thread.videoId)
      : ok(null);
    if (isErr(video)) return video;

    const read = decideThreadRead({
      viewer,
      thread: entry.value?.thread ?? null,
      threadId,
      video: video.value,
    });
    if (isErr(read)) return err(disguised(read.error));
    return entry.value
      ? ok(toThreadView(entry.value, read.value.video, viewer))
      : err(threadNotFound(threadId));
  }

  create(
    author: UserContext,
    acting: ActingChannel,
    videoId: string,
    body: ThreadBody
  ): Promise<Result<ThreadView, CreateThreadServiceFailure>> {
    return createThread(this.deps, author, acting, videoId, body);
  }

  setPinned(
    actor: UserContext | null,
    threadId: string,
    pinned: boolean
  ): Promise<Result<ThreadView, PinThreadServiceFailure>> {
    return setThreadPinned(this.deps, actor, threadId, pinned);
  }

  remove(
    actor: UserContext | null,
    threadId: string,
    body: RemoveThreadBody
  ): Promise<Result<void, RemoveThreadServiceFailure>> {
    return removeThread(this.deps, actor, threadId, body);
  }
}
