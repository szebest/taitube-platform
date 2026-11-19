import { type Result, err, isErr, ok } from '@kit/result';
import type { Video } from '@vp/domain';
import { type UserContext, canUpdateVideo } from '@vp/permissions';
import { type ReadVideoFailure, videoEditForbidden } from './failures';
import { decideVideoRead } from './read-video.rule';

export interface VideoEditAccessInput {
  readonly editor: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
  /** The fields the edit touches; without them the editor needs the right to edit at all. */
  readonly fields?: string[];
}

/**
 * Whether the editor may change this video: the read's verdict first, so a video they cannot see
 * stays disguised and one they can see but may not edit gets a refusal that hides nothing.
 */
export function decideVideoEditAccess(
  input: VideoEditAccessInput
): Result<Video, ReadVideoFailure> {
  const readable = decideVideoRead({
    viewer: input.editor,
    video: input.video?.status === 'DELETED' ? null : input.video,
    videoId: input.videoId,
  });
  if (isErr(readable)) return readable;
  return canUpdateVideo({ user: input.editor, video: readable.value, fields: input.fields })
    ? ok(readable.value)
    : err(videoEditForbidden(input.videoId));
}
