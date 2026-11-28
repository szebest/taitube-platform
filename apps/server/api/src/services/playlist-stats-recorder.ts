import { ignore } from '@kit/result';
import type { ViewBufferPort } from '@vp/core/ports';
import { type PlaylistEvent, type ShareLink, viewDateOf } from '@vp/domain';

/**
 * Hands what happens to a playlist to the view buffer, which the view flush drains into its daily
 * stats. A count the buffer cannot take is a gap in a statistic, never a refused request.
 */
export class PlaylistStatsRecorder {
  constructor(
    private readonly deps: {
      viewBuffer: Pick<
        ViewBufferPort,
        'recordPlaylistOpen' | 'recordPlaylistEvents' | 'recordShareLinkOpen'
      >;
      now: () => number;
    }
  ) {}

  /** Once per viewer and day; a read with neither an account nor a session key counts nothing. */
  async opened(playlistId: string, viewerKey: string | null): Promise<void> {
    if (viewerKey === null) return;
    ignore(
      await this.deps.viewBuffer.recordPlaylistOpen({
        playlistId,
        viewerKey,
        viewDate: this.today(),
      }),
      'an open the buffer could not take is a gap in a statistic'
    );
  }

  /** The link's own opens, once per viewer and day, as a video link counts them. */
  async linkOpened(link: ShareLink, viewerKey: string | null): Promise<void> {
    if (viewerKey === null) return;
    ignore(
      await this.deps.viewBuffer.recordShareLinkOpen({
        targetId: link.targetId,
        linkId: link.id,
        viewerKey,
        viewDate: this.today(),
      }),
      'an open the buffer could not take is a gap in a statistic'
    );
  }

  async record(events: readonly PlaylistEvent[]): Promise<void> {
    const viewDate = this.today();
    ignore(
      await this.deps.viewBuffer.recordPlaylistEvents(
        events.map((event) => ({ ...event, viewDate }))
      ),
      'an event the buffer could not take is a gap in a statistic'
    );
  }

  private today(): string {
    return viewDateOf(new Date(this.deps.now()));
  }
}
