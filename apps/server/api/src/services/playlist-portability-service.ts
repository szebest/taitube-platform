import { type Result, assertNever, err, isErr, isOk, map, ok, unwrapOr } from '@kit/result';
import type { PlaylistImportLineView } from '@vp/api-contracts';
import type {
  AppendItemOutcome,
  NewPlaylistItem,
  PlaylistRepositoryPort,
  VideoRecord,
  VideoRepository,
} from '@vp/core/repositories';
import {
  type ManagePlaylistFailure,
  type PlaylistNotFound,
  checkPlaylistSegment,
  decidePlaylistAction,
  decideVideoRead,
  playlistNotFound,
  resolvePlaylistImportLine,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type InvalidField, validatePlaylistNote } from '@vp/validation';
import {
  type ImportLine,
  type PlaylistDocumentFormat,
  type PlaylistImportFormat,
  exportRow,
  readDocument,
  writeDocument,
} from './playlist-document';

export interface PlaylistPortabilityServiceDeps {
  playlists: PlaylistRepositoryPort;
  videos: Pick<VideoRepository, 'findById'>;
  webUrl: string;
  newId: () => string;
}

type Settled = PlaylistImportLineView;

/** A line that names a watchable video to append, or one whose answer is known already. */
type Resolution =
  | { kind: 'append'; line: number; item: NewPlaylistItem }
  | { kind: 'settled'; view: Settled };

const LINE_STATUS: Readonly<Record<AppendItemOutcome, Settled['status']>> = {
  added: 'added',
  present: 'duplicate',
  'video-missing': 'not_found',
};

/**
 * A playlist out as a document and back in. An import resolves each line to a video of this site
 * by id or by watch URL; any other URL is reported and never fetched.
 */
export class PlaylistPortabilityService {
  constructor(private readonly deps: PlaylistPortabilityServiceDeps) {}

  async export(
    viewer: UserContext | null,
    playlistId: string,
    format: PlaylistDocumentFormat
  ): Promise<
    Result<
      { format: PlaylistDocumentFormat; filename: string; content: string },
      PlaylistNotFound | DatabaseUnavailable
    >
  > {
    const detail = await this.deps.playlists.findDetail(playlistId, viewer);
    if (isErr(detail)) return detail;
    if (!detail.value) return err(playlistNotFound(playlistId));
    const { playlist, items } = detail.value;
    const rows = items.map((entry) => exportRow(entry, this.deps.webUrl));
    return ok({
      format,
      filename: `playlist-${playlist.id}.${format}`,
      content: writeDocument(format, playlist.title, rows),
    });
  }

  async import(
    actor: UserContext,
    playlistId: string,
    request: { format: PlaylistImportFormat; content: string }
  ): Promise<
    Result<{ lines: Settled[] }, ManagePlaylistFailure | InvalidField | DatabaseUnavailable>
  > {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const permitted = decidePlaylistAction(
      { actor, playlist: playlist.value, playlistId },
      'addItem'
    );
    if (isErr(permitted)) return permitted;
    const lines = readDocument(request.format, request.content);
    if (isErr(lines)) return lines;

    const resolved: Resolution[] = [];
    for (const [index, line] of lines.value.entries()) {
      const one = await this.resolve(actor, line, index + 1);
      if (isErr(one)) return one;
      resolved.push(one.value);
    }
    const items = resolved.flatMap((line) => (line.kind === 'append' ? [line.item] : []));
    const appended = await this.deps.playlists.appendItems(playlistId, items, actor.id);
    if (isErr(appended)) return appended;
    if (appended.value === null) return err(playlistNotFound(playlistId));
    const outcomes = appended.value;

    return ok({
      lines: resolved.map((line): Settled => {
        switch (line.kind) {
          case 'settled':
            return line.view;
          case 'append':
            return {
              line: line.line,
              status: LINE_STATUS[outcomes.get(line.item.id) ?? 'video-missing'],
              videoId: line.item.videoId,
            };
          default:
            return assertNever(line, 'Resolution');
        }
      }),
    });
  }

  private async resolve(
    actor: UserContext,
    line: ImportLine,
    number: number
  ): Promise<Result<Resolution, DatabaseUnavailable>> {
    const target = resolvePlaylistImportLine(line.reference, this.deps.webUrl);
    if (target.type === 'unrecognised') {
      return ok({ kind: 'settled', view: { line: number, status: 'unrecognised', videoId: null } });
    }
    const { videoId } = target;
    const found = await this.deps.videos.findById(videoId);
    return map(found, (video) => this.resolved(actor, line, number, videoId, video));
  }

  private resolved(
    actor: UserContext,
    line: ImportLine,
    number: number,
    videoId: string,
    video: VideoRecord | null
  ): Resolution {
    if (!isOk(decideVideoRead({ viewer: actor, video, videoId }))) {
      return { kind: 'settled', view: { line: number, status: 'not_found', videoId } };
    }
    const segment = checkPlaylistSegment(
      { startMs: line.startMs, endMs: line.endMs },
      video?.durationMs ?? null
    );
    return {
      kind: 'append',
      line: number,
      item: {
        id: this.deps.newId(),
        videoId,
        addedBy: actor.id,
        note: unwrapOr(validatePlaylistNote(line.note), null),
        ...unwrapOr(segment, { startMs: null, endMs: null }),
      },
    };
  }
}
