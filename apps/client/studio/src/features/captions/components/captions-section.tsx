import { useQuery } from '@tanstack/react-query';
import { SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';
import { captionsQueryOptions, useApi } from '@vp/queries';
import { Card, Skeleton } from '@vp/ui';
import { useId } from 'react';
import { AddTrackForm } from './add-track-form';
import { AutoCaptionsSelect } from './auto-captions-select';
import { CaptionTrackRow } from './caption-track-row';

/** The video's captions: the switch, the tracks with their status, and what the creator can do with each. Live through `captions.ready`. */
export function CaptionsSection({ videoId }: { videoId: string }) {
  const api = useApi();
  const { tOr } = useT();
  const titleId = useId();
  const captions = useQuery(captionsQueryOptions(api, videoId));

  return (
    <Card.Root asChild>
      <section aria-labelledby={titleId}>
        <Card.Header>
          <Card.Title asChild>
            <h2 id={titleId}>{tOr('studio.captionsTitle', {}, '')}</h2>
          </Card.Title>
          <Card.Description>{tOr('studio.captionsDescription', {}, '')}</Card.Description>
        </Card.Header>
        <Card.Body className="flex flex-col gap-stack">
          {captions.isPending && <Skeleton className="h-24 w-full" />}
          {captions.isError && (
            <SectionError.Root
              role="alert"
              retrying={captions.isFetching}
              onRetry={() => void captions.refetch()}
            >
              <SectionError.Message>
                {tOr('studio.captionsLoadFailed', {}, '')}
              </SectionError.Message>
            </SectionError.Root>
          )}
          {captions.isSuccess && (
            <>
              {captions.data.settings !== undefined && (
                <AutoCaptionsSelect videoId={videoId} settings={captions.data.settings} />
              )}
              {captions.data.tracks.length === 0 ? (
                <p className="m-0 text-body-sm text-fg-muted">
                  {tOr('studio.captionsNoTracks', {}, '')}
                </p>
              ) : (
                <ul
                  aria-label={tOr('studio.captionsTracksLabel', {}, '')}
                  className="m-0 flex list-none flex-col gap-stack p-0"
                >
                  {captions.data.tracks.map((track) => (
                    <CaptionTrackRow key={track.id} videoId={videoId} track={track} />
                  ))}
                </ul>
              )}
              <AddTrackForm
                videoId={videoId}
                taken={captions.data.tracks.flatMap(({ language }) => language ?? [])}
              />
            </>
          )}
        </Card.Body>
      </section>
    </Card.Root>
  );
}
