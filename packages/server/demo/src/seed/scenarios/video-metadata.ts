import { type Result, err, isErr, ok } from '@vp/result';
import type { Actor, Api } from '../api';
import type { SeedFailure } from '../failure';
import { AnySchema, VideoDetailSchema } from '../responses';
import type { VideoSpec } from '../world-types';

const MAX_CONFLICTS = 3;

function sameTags(a: readonly string[] | undefined, b: readonly string[]): boolean {
  return [...(a ?? [])].sort().join('\u0000') === [...b].sort().join('\u0000');
}

/** Sets title, description, category, tags and visibility the way the spec has them; false when nothing needed changing. */
export async function syncMetadata(
  api: Api,
  actor: Actor,
  videoId: string,
  spec: VideoSpec,
  categoryId: string | null
): Promise<Result<boolean, SeedFailure>> {
  for (let attempt = 0; attempt < MAX_CONFLICTS; attempt++) {
    const current = await api.send(
      { actor, method: 'GET', path: `/v1/videos/${videoId}` },
      VideoDetailSchema
    );
    if (isErr(current)) return current;
    const video = current.value;

    const inSync =
      video.title === spec.title &&
      (video.description ?? '') === spec.description &&
      video.visibility === spec.visibility &&
      (categoryId === null || video.categoryId === categoryId) &&
      sameTags(video.tags, spec.tags);
    if (inSync) return ok(false);

    const patched = await api.send(
      {
        actor,
        method: 'PATCH',
        path: `/v1/creator/videos/${videoId}`,
        json: {
          title: spec.title,
          description: spec.description,
          visibility: spec.visibility,
          tags: [...spec.tags],
          ...(categoryId === null ? {} : { categoryId }),
          version: video.version,
        },
      },
      AnySchema
    );
    if (!isErr(patched)) return ok(true);
    if (patched.error.kind !== 'http' || patched.error.status !== 409) return patched;
  }
  return err({
    kind: 'invalid',
    message: `video ${videoId} kept changing under the metadata edit`,
  });
}
