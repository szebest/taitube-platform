import type { Video } from '@vp/api-contracts';
import { publishedAt, videoDuration } from '@vp/intl';
import { Format, useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';

import { LinerNotes } from '#app/components/watch/liner-notes';
import { usePlayerSeek, usePlayerTime } from '#app/features/player';

import { type Chapter, chaptersOf, type DescriptionToken, tokenizeDescription } from '../timecodes';

function ChapterStrip({ chapters }: { chapters: readonly Chapter[] }) {
  const { format } = useFormat();
  const current = usePlayerTime((seconds) =>
    chapters.findLastIndex((chapter) => chapter.seconds <= seconds)
  );

  return (
    <LinerNotes.Chapters>
      {chapters.map(({ seconds, title }, index) => (
        <LinerNotes.Chapter
          key={seconds}
          id={String(seconds)}
          seconds={seconds}
          time={unwrapOr(format(videoDuration(seconds)), '')}
          current={index === current}
        >
          {title}
        </LinerNotes.Chapter>
      ))}
    </LinerNotes.Chapters>
  );
}

function DescriptionPart({ token }: { token: DescriptionToken }) {
  switch (token.type) {
    case 'text':
      return token.text;
    case 'link':
      return (
        <a href={token.href} target="_blank" rel="noopener noreferrer nofollow">
          {token.text}
        </a>
      );
    case 'time':
      return <LinerNotes.Timecode seconds={token.seconds}>{token.text}</LinerNotes.Timecode>;
  }
}

/** The views and date, the description with links and timecodes that seek the player, and its chapters. */
export function WatchLinerNotes({ video }: { video: Video }) {
  const { tOr } = useT();
  const { seek } = usePlayerSeek();

  const description = video.description ?? '';
  const chapters = chaptersOf(description);

  return (
    <LinerNotes.Root onSeek={seek}>
      <LinerNotes.Meta>
        {tOr('videos.views', { count: video.viewsCount ?? 0 }, '')}
        {' · '}
        <time dateTime={video.createdAt}>
          <Format value={publishedAt(video.createdAt).relative} />
        </time>
      </LinerNotes.Meta>
      {description && (
        <LinerNotes.Body>
          {tokenizeDescription(description).map((token) => (
            <DescriptionPart key={token.start} token={token} />
          ))}
        </LinerNotes.Body>
      )}
      {chapters.length > 0 && <ChapterStrip chapters={chapters} />}
    </LinerNotes.Root>
  );
}
