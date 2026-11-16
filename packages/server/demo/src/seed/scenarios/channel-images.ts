import { join } from 'node:path';
import { type Result, err, fromPromise, isErr, ok } from '@vp/result';
import type { Actor } from '../api';
import type { SeedFailure } from '../failure';
import { IMAGE_CROPS, IMAGE_SIZES, ensureImage } from '../media';
import { AccountSchema, AnySchema, PreparedImageSchema } from '../responses';
import { type Scenario, type ScenarioContext, actorOf } from '../scenario';
import { createTally } from '../tally';
import type { UserSpec } from '../world-types';

const CONTENT_TYPE = 'image/png';
const SETTLE_TIMEOUT_MS = 30_000;
const SETTLE_POLL_MS = 1_000;

async function uploadImage(
  { api, ports }: ScenarioContext,
  actor: Actor,
  kind: keyof typeof IMAGE_SIZES,
  path: string
): Promise<Result<void, SeedFailure>> {
  const bytes = await ports.files.read(path);
  const base = `/v1/me/channel/images/${kind}`;
  const prepared = await api.send(
    {
      actor,
      method: 'POST',
      path: `${base}/upload`,
      json: { contentType: CONTENT_TYPE, sizeBytes: bytes.byteLength },
    },
    PreparedImageSchema
  );
  if (isErr(prepared)) return prepared;

  const put = await fromPromise(
    () =>
      ports.fetch(prepared.value.uploadUrl, {
        method: 'PUT',
        headers: prepared.value.headers,
        body: bytes,
      }),
    (cause): SeedFailure => ({
      kind: 'network',
      method: 'PUT',
      path: prepared.value.uploadUrl,
      message: String(cause),
    })
  );
  if (isErr(put)) return put;
  if (!put.value.ok) {
    return err({
      kind: 'http',
      method: 'PUT',
      path: prepared.value.uploadUrl,
      status: put.value.status,
      message: 'storage refused the image',
    });
  }

  const { width, height } = IMAGE_SIZES[kind];
  const completed = await api.send(
    {
      actor,
      method: 'POST',
      path: `${base}/complete`,
      json: { uploadId: prepared.value.uploadId, width, height, ...IMAGE_CROPS[kind] },
    },
    AnySchema
  );
  return isErr(completed) ? completed : ok(undefined);
}

async function hasImage({ api }: ScenarioContext, actor: Actor, kind: keyof typeof IMAGE_SIZES) {
  const account = await api.send({ actor, method: 'GET', path: '/v1/me/account' }, AccountSchema);
  if (isErr(account)) return account;
  return ok(
    (kind === 'avatar' ? account.value.channel.avatarUrl : account.value.channel.bannerUrl) != null
  );
}

async function settled(context: ScenarioContext, actor: Actor, kind: keyof typeof IMAGE_SIZES) {
  const { clock } = context.ports;
  const deadline = clock.now() + SETTLE_TIMEOUT_MS;
  while (clock.now() < deadline) {
    const present = await hasImage(context, actor, kind);
    if (!isErr(present) && present.value) return true;
    await clock.sleep(SETTLE_POLL_MS);
  }
  return false;
}

export const channelImages: Scenario = {
  name: 'channel-images',
  essential: false,
  needsReady: false,
  requires: [
    'GET /v1/me/account',
    'POST /v1/me/channel/images/{kind}/upload',
    'POST /v1/me/channel/images/{kind}/complete',
  ],
  async run(context) {
    const { world, options, ports } = context;
    const tally = createTally();
    const mediaDir = join(options.workDir, 'media');
    const owners: UserSpec[] = world.users.filter((user) => user.ownsChannel);

    for (const user of owners) {
      const actor = actorOf(user);
      for (const kind of ['avatar', 'banner'] as const) {
        const present = await hasImage(context, actor, kind);
        if (isErr(present)) {
          tally.fail(present.error);
        } else if (present.value) {
          tally.existing();
        } else {
          const file = await ensureImage(ports, mediaDir, user, kind);
          if (isErr(file)) {
            tally.fail(file.error);
            continue;
          }
          const sent = await uploadImage(context, actor, kind, file.value.path);
          if (isErr(sent)) tally.fail(sent.error);
          else if (await settled(context, actor, kind)) tally.created();
          else tally.skipped(`${user.handle} ${kind} still processing`);
        }
      }
    }
    return tally.outcome('channel images');
  },
};
