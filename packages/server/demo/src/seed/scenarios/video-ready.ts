import { isErr } from '@vp/result';
import type { SeedFailure } from '../failure';
import { AnySchema } from '../responses';
import type { ScenarioContext } from '../scenario';
import { actorOf, userById, userByKind } from '../scenario';
import { type LibraryVideo, listLibrary } from './video-library';

const POLL_MS = 2_000;
const TIMEOUT_MS = 15 * 60_000;
const SETTLED = ['READY', 'FAILED', 'REJECTED', 'ABANDONED', 'DELETED'];

function histogram(statuses: Iterable<string>): string {
  const counts = new Map<string, number>();
  for (const status of statuses) counts.set(status, (counts.get(status) ?? 0) + 1);
  return [...counts].map(([status, count]) => `${count} ${status.toLowerCase()}`).join(', ');
}

const APPROVE = 'POST /v1/admin/videos/{id}/screening/approve';

/** Polls every owner's library until each seeded video is READY or has settled elsewhere; a video screening holds is approved as the admin. */
export async function waitForReady(
  { world, api, ports, state, log, routes }: ScenarioContext,
  onFailure: (failure: SeedFailure) => void
): Promise<void> {
  const started = ports.clock.now();
  const owners = [...new Set([...state.videos.values()].map((video) => video.spec.ownerId))];
  const admin = userByKind(world, 'admin');
  const canApprove = admin !== undefined && routes.has(APPROVE);
  const decided = new Set<string>();
  const gaveUp = new Set<string>();
  let lastSummary = '';

  for (;;) {
    const byId = new Map<string, LibraryVideo>();
    for (const ownerId of owners) {
      const owner = userById(world, ownerId);
      if (!owner) continue;
      const library = await listLibrary(api, actorOf(owner));
      if (isErr(library)) return onFailure(library.error);
      for (const item of library.value) byId.set(item.id, item);
    }
    for (const video of state.videos.values()) {
      const item = byId.get(video.id);
      video.status = item?.status ?? video.status;
      video.durationMs = item?.durationMs ?? video.durationMs;
    }

    for (const video of state.videos.values()) {
      if (!admin || !canApprove || video.status !== 'HELD' || decided.has(video.id)) continue;
      decided.add(video.id);
      log(`  screening held ${video.spec.key}, approving it as ${admin.displayName}`);
      const approved = await api.send(
        {
          actor: actorOf(admin),
          method: 'POST',
          path: `/v1/admin/videos/${video.id}/screening/approve`,
        },
        AnySchema
      );
      if (isErr(approved)) {
        gaveUp.add(video.id);
        onFailure(approved.error);
      }
    }

    const statuses = [...state.videos.values()].map((video) => video.status);
    const summary = histogram(statuses);
    if (summary !== lastSummary) {
      log(`  waiting for the pipeline: ${summary}`);
      lastSummary = summary;
    }
    const waiting = [...state.videos.values()].some(
      (video) =>
        !gaveUp.has(video.id) &&
        (video.status === 'HELD' ? canApprove : !SETTLED.includes(video.status))
    );
    if (!waiting) break;
    if (ports.clock.now() - started > TIMEOUT_MS) {
      return onFailure({
        kind: 'timeout',
        message: `not every video settled within ${TIMEOUT_MS / 60_000} minutes (${summary})`,
      });
    }
    await ports.clock.sleep(POLL_MS);
  }

  const stuck = [...state.videos.values()].filter((video) => video.status !== 'READY');
  if (stuck.length > 0) {
    onFailure({
      kind: 'invalid',
      message: `${stuck.length} videos did not reach READY: ${stuck.map((video) => `${video.spec.key} ${video.status}`).join(', ')}`,
    });
  }
}
