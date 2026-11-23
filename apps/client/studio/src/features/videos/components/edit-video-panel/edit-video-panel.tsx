import { useT } from '@kit/intl-react';
import { Callout, Skeleton } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import type { Video } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import {
  generationInFlight,
  generationsQueryOptions,
} from '#app/features/videos/api/video-pipeline-queries';
import { ClipSuggestionsList } from '../clip-suggestions-list/clip-suggestions-list';
import { ReplaceFileSection } from '../replace-file-section/replace-file-section';
import { TrimBlurEditor } from '../trim-blur-editor/trim-blur-editor';

/** The Edit video tab: a new file, a trim and blurs over the base, and the clips worth cutting. */
export function EditVideoPanel({ video }: { video: Video }) {
  const api = useApi();
  const { tOr } = useT();
  const generations = useQuery(generationsQueryOptions(api, video.id));
  const items = generations.data?.items ?? [];
  const busy = generationInFlight(generations.data);
  const [latest] = items;
  const playing = items.find(({ generation }) => generation === generations.data?.activeGeneration);
  const notice = busy
    ? { tone: 'info' as const, text: tOr('studio.editVideoRendering', {}, '') }
    : latest?.errorCode
      ? { tone: 'danger' as const, text: tOr('studio.editVideoFailed', {}, '') }
      : playing?.needsReview
        ? { tone: 'warning' as const, text: tOr('studio.editVideoNeedsReview', {}, '') }
        : null;

  return (
    <section className="flex flex-col gap-section" aria-labelledby="edit-video-title">
      <header className="flex flex-col gap-inline">
        <h2 id="edit-video-title">{tOr('studio.editVideoTitle', {}, '')}</h2>
        <p className="text-fg-muted">{tOr('studio.editVideoDescription', {}, '')}</p>
      </header>
      {notice && (
        <Callout.Root tone={notice.tone} role="status">
          <Callout.Icon />
          <Callout.Body>{notice.text}</Callout.Body>
        </Callout.Root>
      )}
      <ReplaceFileSection videoId={video.id} busy={busy} />
      {generations.isPending && <Skeleton className="h-24 w-full" />}
      {generations.isError && <p role="alert">{tOr('studio.editVideoLoadFailed', {}, '')}</p>}
      {generations.data && (
        <TrimBlurEditor
          key={generations.data.edit?.updatedAt ?? generations.data.editBase.generation}
          video={video}
          generations={generations.data}
          busy={busy}
        />
      )}
      <ClipSuggestionsList video={video} />
    </section>
  );
}
