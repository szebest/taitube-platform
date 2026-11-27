import { Field, Tabs, Textarea } from '@kit/ui';
import type { ReactNode } from 'react';
import { TimelineRangeEditor } from '#app/components/video/timeline-range-editor';
import { useT } from '#app/lib/messages';
import { formatTimecode } from '#app/utils/timecode';
import { POST_LIMITS } from './constants';
import { PostComposerCount } from './post-composer-count';
import { usePostComposer } from './post-composer.context';

function ShareComment() {
  const { tOr } = useT();
  const { draft, change } = usePostComposer('Comment');

  return (
    <Field.Root>
      <Field.Label>{tOr('studio.composerShareComment', {}, '')}</Field.Label>
      <Textarea
        autoGrow
        value={draft.comment}
        onChange={(event) => change({ comment: event.target.value })}
      />
      <Field.Hint>
        <PostComposerCount length={draft.comment.length} max={POST_LIMITS.comment} />
      </Field.Hint>
    </Field.Root>
  );
}

export interface PostComposerShareProps {
  /** The picker of what is shared; it reads and writes the draft's target itself. */
  children: ReactNode;
}

/** A video with a comment, and the second the card opens it at when the video's length is known. */
export function PostComposerVideo({ children }: PostComposerShareProps) {
  const { tOr } = useT();
  const { draft, change } = usePostComposer('Video');
  const { video, startMs } = draft;
  const durationMs = video?.durationMs ?? 0;

  return (
    <Tabs.Panel value="video_share" className="flex flex-col gap-stack">
      {children}
      {video && durationMs > 0 && (
        <TimelineRangeEditor
          aria-label={tOr('studio.composerStartLabel', {}, '')}
          durationMs={durationMs}
          sprite={video.sprite}
          summary={tOr('studio.composerStartSummary', { time: formatTimecode(startMs) }, '')}
          control={{
            mode: 'position',
            positionMs: Math.min(startMs, durationMs),
            onPositionChange: (position) => change({ startMs: position }),
            label: tOr('studio.composerStartLabel', {}, ''),
          }}
        />
      )}
      <ShareComment />
    </Tabs.Panel>
  );
}

/** A playlist with a comment. */
export function PostComposerPlaylist({ children }: PostComposerShareProps) {
  return (
    <Tabs.Panel value="playlist_share" className="flex flex-col gap-stack">
      {children}
      <ShareComment />
    </Tabs.Panel>
  );
}
