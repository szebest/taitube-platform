import { err, isErr } from '@vp/result';
import type { SeedFailure } from '../failure';
import { AnySchema } from '../responses';
import { type Scenario, type ScenarioContext, actorOf, userById } from '../scenario';
import { createTally } from '../tally';
import type { VideoSpec } from '../world-types';
import { listLibrary } from './video-library';
import { syncMetadata } from './video-metadata';
import { waitForReady } from './video-ready';

const UPLOADS_PER_OWNER = 2;
const UPLOAD_ATTEMPTS = 5;

async function uploadWithRetry(context: ScenarioContext, spec: VideoSpec, path: string) {
  const owner = userById(context.world, spec.ownerId);
  const { ports, log } = context;
  let last: SeedFailure = { kind: 'invalid', message: `no owner for ${spec.key}` };
  for (let attempt = 1; owner && attempt <= UPLOAD_ATTEMPTS; attempt++) {
    const uploaded = await ports.uploader.upload({
      token: ports.signToken(owner.id, owner.tokenRole),
      filePath: path,
      title: spec.title,
      contentType: 'video/mp4',
      onProgress: () => {},
    });
    if (!isErr(uploaded)) return uploaded;
    last = uploaded.error;
    if (last.kind !== 'http' || last.status !== 429) break;
    log(`  upload rate limit, waiting (attempt ${attempt})`);
    await ports.clock.sleep(2_000 * 2 ** attempt);
  }
  return err(last);
}

async function uploadOwnerVideos(
  context: ScenarioContext,
  queue: VideoSpec[],
  onDone: (spec: VideoSpec, id: string) => void,
  onFailure: (failure: SeedFailure) => void
): Promise<void> {
  const next = [...queue];
  const lane = async () => {
    for (let spec = next.shift(); spec; spec = next.shift()) {
      const path = context.state.clips.get(spec.key);
      if (!path) {
        onFailure({ kind: 'invalid', message: `no clip rendered for ${spec.key}` });
        continue;
      }
      context.log(`  uploading ${spec.key}: ${spec.title}`);
      const uploaded = await uploadWithRetry(context, spec, path);
      if (isErr(uploaded)) onFailure(uploaded.error);
      else onDone(spec, uploaded.value.videoId);
    }
  };
  await Promise.all(Array.from({ length: UPLOADS_PER_OWNER }, lane));
}

export const videos: Scenario = {
  name: 'videos',
  essential: false,
  needsReady: false,
  requires: [
    'POST /v1/uploads',
    'GET /v1/creator/videos',
    'GET /v1/videos/{id}',
    'PATCH /v1/creator/videos/{id}',
  ],
  async run(context) {
    const { world, api, state, options, log } = context;
    const tally = createTally();
    const owners = [...new Set(world.videos.map((video) => video.ownerId))];

    await Promise.all(
      owners.map(async (ownerId) => {
        const owner = userById(world, ownerId);
        if (!owner) return;
        const library = await listLibrary(api, actorOf(owner));
        if (isErr(library)) return tally.fail(library.error);
        const byTitle = new Map(library.value.map((item) => [item.title, item]));
        const queue: VideoSpec[] = [];

        for (const spec of world.videos.filter((video) => video.ownerId === ownerId)) {
          const found = byTitle.get(spec.title);
          if (found?.status === 'UPLOADING') {
            log(`  replacing the unfinished upload of ${spec.key}`);
            const removed = await api.send(
              { actor: actorOf(owner), method: 'DELETE', path: `/v1/creator/videos/${found.id}` },
              AnySchema
            );
            if (isErr(removed)) tally.fail(removed.error);
            else queue.push(spec);
          } else if (found) {
            state.videos.set(spec.key, {
              spec,
              id: found.id,
              status: found.status,
              durationMs: found.durationMs ?? null,
            });
            tally.existing();
          } else queue.push(spec);
        }
        await uploadOwnerVideos(
          context,
          queue,
          (spec, id) => {
            state.videos.set(spec.key, { spec, id, status: 'UPLOADED', durationMs: null });
            tally.created();
          },
          (failure) => tally.fail(failure)
        );
      })
    );

    if (!options.withWorker) {
      log(
        '  no worker: not waiting for READY, leaving metadata and everything that needs READY videos'
      );
      return tally.outcome('videos');
    }

    await waitForReady(context, (failure) => tally.fail(failure));

    for (const video of state.videos.values()) {
      if (video.status !== 'READY') continue;
      const owner = userById(world, video.spec.ownerId);
      if (!owner) continue;
      const synced = await syncMetadata(
        api,
        actorOf(owner),
        video.id,
        video.spec,
        state.categoryIds.get(video.spec.categorySlug) ?? null
      );
      if (isErr(synced)) tally.fail(synced.error);
    }
    return tally.outcome('videos');
  },
};
