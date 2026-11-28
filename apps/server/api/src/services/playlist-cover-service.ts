import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, err, isErr, ok } from '@kit/result';
import type {
  ChannelImageRepositoryPort,
  ChannelRepositoryPort,
  PlaylistRepositoryPort,
} from '@vp/core/repositories';
import { type CropRect, IMAGE_UPLOAD_HAS_VARIANTS, PLAYLIST_COVER_KEPT_WIDTH } from '@vp/domain';
import {
  type ChannelNotFound,
  type DeletePlaylistFailure,
  channelNotFound,
  decidePlaylistCoverUpload,
} from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import { channelImageVariantKey } from '@vp/storage';
import type {
  ChannelImagePipelineService,
  CompleteImageFailure,
  PrepareImageFailure,
  PreparedImageUpload,
  QueuedImageUpload,
} from './channel-image-pipeline-service';

const KIND = 'playlist-cover';

export interface PlaylistCoverServiceDeps {
  playlists: Pick<PlaylistRepositoryPort, 'findSeated'>;
  channels: Pick<ChannelRepositoryPort, 'findPrimaryByUserId'>;
  images: Pick<ChannelImageRepositoryPort, 'findById'>;
  pipeline: Pick<ChannelImagePipelineService, 'prepareUpload' | 'queueUpload'>;
}

export interface CompleteCoverInput {
  uploadId: string;
  width: number;
  height: number;
  crop: CropRect;
}

type CoverFailure = DeletePlaylistFailure | ChannelNotFound | DatabaseUnavailable;

/**
 * A playlist's custom cover goes through the channel image pipeline under its owner's primary
 * channel. Nothing here touches the playlist: once the job is done the owner names the upload in
 * an edit, and `readyCoverKey` is what that edit keeps.
 */
export class PlaylistCoverService {
  constructor(private readonly deps: PlaylistCoverServiceDeps) {}

  async prepare(
    actor: UserContext,
    playlistId: string,
    request: { contentType: string; sizeBytes: number }
  ): Promise<Result<PreparedImageUpload, CoverFailure | PrepareImageFailure>> {
    const channelId = await this.ownerChannel(actor, playlistId);
    if (isErr(channelId)) return channelId;
    return await this.deps.pipeline.prepareUpload(
      { channelId: channelId.value, uploadedBy: actor.id },
      { kind: KIND, ...request }
    );
  }

  async complete(
    actor: UserContext,
    playlistId: string,
    input: CompleteCoverInput
  ): Promise<Result<QueuedImageUpload, CoverFailure | CompleteImageFailure>> {
    const channelId = await this.ownerChannel(actor, playlistId);
    if (isErr(channelId)) return channelId;
    return await this.deps.pipeline.queueUpload(channelId.value, KIND, input);
  }

  /** The kept variant of `uploadId` when it is a cover of `ownerId`'s that is done; else null. */
  async readyCoverKey(
    ownerId: string,
    uploadId: string
  ): Promise<Result<string | null, DatabaseUnavailable>> {
    const upload = await this.deps.images.findById(uploadId);
    if (isErr(upload)) return upload;
    const channel = await this.deps.channels.findPrimaryByUserId(ownerId);
    if (isErr(channel)) return channel;

    const found = upload.value;
    if (
      found === null ||
      found.kind !== KIND ||
      !IMAGE_UPLOAD_HAS_VARIANTS[found.status] ||
      found.version === null ||
      found.channelId !== channel.value?.id
    ) {
      return ok(null);
    }
    const kept = String(PLAYLIST_COVER_KEPT_WIDTH);
    return ok(channelImageVariantKey(found.channelId, KIND, kept, found.version));
  }

  private async ownerChannel(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<string, CoverFailure>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const decided = decidePlaylistCoverUpload({ actor, playlist: playlist.value, playlistId });
    if (isErr(decided)) return decided;

    const channel = await this.deps.channels.findPrimaryByUserId(decided.value.ownerId);
    if (isErr(channel)) return channel;
    return channel.value ? ok(channel.value.id) : err(channelNotFound(decided.value.ownerId));
  }
}
