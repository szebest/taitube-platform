import type {
  ChannelAuditRepositoryPort,
  ChannelImageCommit,
  ChannelImageCompletion,
  ChannelImageRepositoryPort,
  ChannelRepositoryPort,
  NewChannelImageUpload,
  UserEventRepository,
} from '@vp/core/repositories';
import { channelImageFailed, channelImageReady, type ChannelImageUpload } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, ok, type Result } from '@vp/result';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';

export interface InMemoryChannelImageDeps {
  channels: Pick<ChannelRepositoryPort, 'findById'> &
    Pick<InMemoryChannelRepository, 'advanceImageVersion'>;
  audit: ChannelAuditRepositoryPort;
  userEvents: UserEventRepository;
}

const SETTLED = ['ready', 'superseded', 'failed', 'purged'];

export class InMemoryChannelImageRepository implements ChannelImageRepositoryPort {
  private readonly uploads = new Map<string, ChannelImageUpload>();

  constructor(private readonly deps: InMemoryChannelImageDeps) {}

  async create(
    input: NewChannelImageUpload
  ): Promise<Result<ChannelImageUpload, DatabaseUnavailable>> {
    const now = new Date();
    const upload: ChannelImageUpload = {
      ...input,
      status: 'issued',
      width: null,
      height: null,
      crops: null,
      version: null,
      failure: null,
      createdAt: now,
      updatedAt: now,
    };
    this.uploads.set(upload.id, upload);
    return ok({ ...upload });
  }

  async findById(id: string): Promise<Result<ChannelImageUpload | null, DatabaseUnavailable>> {
    const found = this.uploads.get(id);
    return ok(found ? { ...found } : null);
  }

  async queue(
    id: string,
    completion: ChannelImageCompletion
  ): Promise<Result<ChannelImageUpload | null, DatabaseUnavailable>> {
    const upload = this.uploads.get(id);
    if (!upload || (upload.status !== 'issued' && upload.status !== 'queued')) return ok(null);
    if (upload.status === 'queued') return ok({ ...upload });

    const version = await this.nextVersion(upload);
    if (isErr(version)) return version;
    Object.assign(upload, completion, { status: 'queued', version: version.value });
    upload.updatedAt = new Date();
    return ok({ ...upload });
  }

  async commit(
    id: string,
    defaultUrl: string
  ): Promise<Result<ChannelImageCommit | null, DatabaseUnavailable>> {
    const upload = this.uploads.get(id);
    if (!upload) return ok(null);
    if (upload.status === 'ready' || upload.status === 'superseded') {
      return ok({ upload: { ...upload }, applied: upload.status === 'ready' });
    }
    if (upload.status !== 'queued' || upload.version === null || upload.crops === null) {
      return ok(null);
    }

    const applied = this.deps.channels.advanceImageVersion(
      upload.channelId,
      upload.kind,
      upload.version,
      upload.crops,
      defaultUrl
    );
    upload.status = applied ? 'ready' : 'superseded';
    upload.updatedAt = new Date();
    if (applied) await this.announceReady(upload, upload.version);
    return ok({ upload: { ...upload }, applied });
  }

  async fail(
    id: string,
    reason: string
  ): Promise<Result<ChannelImageUpload | null, DatabaseUnavailable>> {
    const upload = this.uploads.get(id);
    if (!upload) return ok(null);
    if (SETTLED.includes(upload.status)) return ok({ ...upload });

    upload.status = 'failed';
    upload.failure = reason;
    upload.updatedAt = new Date();
    const announced = await this.deps.userEvents.append({
      userId: upload.uploadedBy,
      ...channelImageFailed({
        uploadId: upload.id,
        channelId: upload.channelId,
        kind: upload.kind,
        reason,
      }),
    });
    return isErr(announced) ? announced : ok({ ...upload });
  }

  async listPurgeable(
    olderThan: Date,
    limit: number
  ): Promise<Result<ChannelImageUpload[], DatabaseUnavailable>> {
    const purgeable: ChannelImageUpload[] = [];
    for (const upload of this.uploads.values()) {
      if (upload.updatedAt >= olderThan) continue;
      if (['issued', 'failed', 'superseded'].includes(upload.status)) purgeable.push(upload);
      else if (upload.status === 'ready' && (await this.isReplaced(upload))) purgeable.push(upload);
    }
    purgeable.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    return ok(purgeable.slice(0, limit).map((upload) => ({ ...upload })));
  }

  async markPurged(ids: readonly string[]): Promise<Result<void, DatabaseUnavailable>> {
    for (const id of ids) {
      const upload = this.uploads.get(id);
      if (upload) {
        upload.status = 'purged';
        upload.updatedAt = new Date();
      }
    }
    return ok();
  }

  clear(): void {
    this.uploads.clear();
  }

  private async currentVersion(
    upload: ChannelImageUpload
  ): Promise<Result<number, DatabaseUnavailable>> {
    const channel = await this.deps.channels.findById(upload.channelId);
    if (isErr(channel)) return channel;
    const held =
      upload.kind === 'avatar' ? channel.value?.avatarVersion : channel.value?.bannerVersion;
    return ok(held ?? 0);
  }

  private async nextVersion(
    upload: ChannelImageUpload
  ): Promise<Result<number, DatabaseUnavailable>> {
    const current = await this.currentVersion(upload);
    if (isErr(current)) return current;
    const queued = [...this.uploads.values()]
      .filter((other) => other.channelId === upload.channelId && other.kind === upload.kind)
      .map((other) => other.version ?? 0);
    return ok(Math.max(current.value, ...queued) + 1);
  }

  private async isReplaced(upload: ChannelImageUpload): Promise<boolean> {
    const current = await this.currentVersion(upload);
    return !isErr(current) && (upload.version ?? 0) < current.value;
  }

  private async announceReady(upload: ChannelImageUpload, version: number): Promise<void> {
    await this.deps.audit.append({
      channelId: upload.channelId,
      actorUserId: upload.uploadedBy,
      action: 'channel.updated',
      targetType: 'channel',
      targetId: upload.channelId,
      meta: { fields: [upload.kind] },
    });
    await this.deps.userEvents.append({
      userId: upload.uploadedBy,
      ...channelImageReady({
        uploadId: upload.id,
        channelId: upload.channelId,
        kind: upload.kind,
        version,
      }),
    });
  }
}
