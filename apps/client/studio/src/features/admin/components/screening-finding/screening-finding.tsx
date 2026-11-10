import { useT } from '@vp/intl-react';
import { Badge } from '@vp/ui';
import { useId } from 'react';
import type { ScreeningFinding as Finding } from '#app/features/admin/api/admin-screening';
import {
  useClock,
  useSecondsRange,
  useShare,
} from '#app/features/admin/hooks/use-screening-format';

export interface ScreeningFindingProps {
  finding: Finding;
}

/** One reason the check held or flagged a video, with the proof a moderator reads: the match, the frames and the text hits. */
export function ScreeningFinding({ finding }: ScreeningFindingProps) {
  const { tOr } = useT();
  const clock = useClock();
  const share = useShare();
  const rangeText = useSecondsRange();
  const headingId = useId();
  const { match, frames, flaggedShare, signals, profanity } = finding;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-stack rounded-card border border-divider p-inset-card"
    >
      <h3 id={headingId} className="m-0 flex items-center gap-inline text-label">
        {tOr('studio.screeningReasonName', { reason: finding.reason }, '')}
        <Badge size="sm" tone="neutral">
          {tOr('studio.screeningFindingScore', { score: share(finding.score) }, '')}
        </Badge>
      </h3>
      {match && (
        <div className="flex gap-stack">
          {match.thumbnailUrl && (
            <img src={match.thumbnailUrl} alt="" className="w-row-thumb shrink-0 rounded-thumb" />
          )}
          <div className="flex min-w-0 flex-col gap-inline text-caption">
            <span className="text-label">
              {match.title === null
                ? tOr('studio.screeningMatchGone', {}, '')
                : tOr(
                    'studio.screeningMatchLine',
                    { title: match.title, channel: match.channel?.displayName ?? '' },
                    ''
                  )}
            </span>
            {match.sameChannel && <span>{tOr('studio.screeningSameChannel', {}, '')}</span>}
            {match.mirrored && <span>{tOr('studio.screeningMirrored', {}, '')}</span>}
            {match.videoCoverage !== null && (
              <span>
                {tOr('studio.screeningCoverageVideo', { value: share(match.videoCoverage) }, '')}
              </span>
            )}
            {match.audioCoverage !== null && (
              <span>
                {tOr('studio.screeningCoverageAudio', { value: share(match.audioCoverage) }, '')}
              </span>
            )}
            {match.sourceRange && (
              <span>
                {tOr('studio.screeningSourceRange', { range: rangeText(match.sourceRange) }, '')}
              </span>
            )}
            {match.matchedRange && (
              <span>
                {tOr('studio.screeningMatchedRange', { range: rangeText(match.matchedRange) }, '')}
              </span>
            )}
          </div>
        </div>
      )}
      {flaggedShare !== null && (
        <p className="m-0 text-caption">
          {tOr('studio.screeningFlaggedShare', { share: share(flaggedShare) }, '')}
        </p>
      )}
      {frames.length > 0 && (
        <ul
          aria-label={tOr('studio.screeningFrames', {}, '')}
          className="m-0 flex flex-wrap gap-inline p-0"
        >
          {frames.map((frame) => (
            <li key={frame.timestampSeconds} className="list-none">
              <img
                src={frame.url}
                alt={tOr(
                  'studio.screeningFrameAt',
                  { time: clock(frame.timestampSeconds), score: share(frame.score) },
                  ''
                )}
                className="h-24 rounded-thumb"
              />
            </li>
          ))}
        </ul>
      )}
      {signals.length > 0 && (
        <ul aria-label={tOr('studio.screeningSignals', {}, '')} className="m-0 text-caption">
          {signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      )}
      {profanity.length > 0 && (
        <p className="m-0 text-caption">
          {tOr('studio.screeningProfanity', {}, '')}: {profanity.join(', ')}
        </p>
      )}
    </section>
  );
}
