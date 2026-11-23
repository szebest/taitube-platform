import { EmptyState, SpriteStrip } from '@kit/components';
import { useFormat, useT } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Button, Skeleton, useToast } from '@kit/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ClipSuggestionView, Video } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { createClipMutationOptions } from '#app/features/videos/api/video-pipeline-mutations';
import { clipSuggestionsQueryOptions } from '#app/features/videos/api/video-pipeline-queries';
import { formatTimecode } from '#app/utils/timecode';

const PERCENT = 100;

/** The windows viewers stayed for, each over the sprite frames of its span, with a button to clip it. */
export function ClipSuggestionsList({ video }: { video: Video }) {
  const api = useApi();
  const toast = useToast();
  const { tOr } = useT();
  const { format } = useFormat();
  const suggestions = useQuery(clipSuggestionsQueryOptions(api, video.id));
  const create = useMutation(createClipMutationOptions(api, video.id));
  const items = suggestions.data?.items ?? [];
  const durationMs = video.durationMs ?? 0;

  const clip = ({ startMs, endMs, chapterTitle }: ClipSuggestionView) =>
    create.mutate(
      {
        startMs,
        endMs,
        title:
          chapterTitle ?? tOr('studio.clipSuggestionTitle', { start: formatTimecode(startMs) }, ''),
      },
      {
        onSuccess: () => toast({ tone: 'success', title: tOr('studio.clipCreated', {}, '') }),
        onError: () => toast({ tone: 'danger', title: tOr('studio.clipCreateFailed', {}, '') }),
      }
    );

  return (
    <section className="flex flex-col gap-stack" aria-labelledby="clip-suggestions-title">
      <header className="flex flex-col gap-inline">
        <h3 id="clip-suggestions-title">{tOr('studio.clipSuggestionsTitle', {}, '')}</h3>
        <p className="m-0 text-fg-muted">{tOr('studio.clipSuggestionsDescription', {}, '')}</p>
      </header>
      {suggestions.isPending && <Skeleton className="h-24 w-full" />}
      {suggestions.isError && <p role="alert">{tOr('studio.clipSuggestionsLoadFailed', {}, '')}</p>}
      {suggestions.isSuccess && items.length === 0 && (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.clipSuggestionsEmpty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      )}
      {items.length > 0 && (
        <ul
          aria-label={tOr('studio.clipSuggestionsListLabel', {}, '')}
          className="m-0 flex list-none flex-col gap-stack p-0"
        >
          {items.map((item) => {
            const start = formatTimecode(item.startMs);
            return (
              <li key={item.startMs} className="flex flex-col gap-inline">
                {video.sprite && durationMs > 0 && (
                  <SpriteStrip
                    sprite={video.sprite}
                    durationMs={durationMs}
                    shade={{ startMs: item.startMs, endMs: item.endMs }}
                  />
                )}
                <div className="flex flex-wrap items-center justify-between gap-stack">
                  <span className="flex flex-col">
                    <span className="tabular-nums">
                      {tOr(
                        'studio.clipSuggestionRange',
                        { start, end: formatTimecode(item.endMs) },
                        ''
                      )}
                      {item.chapterTitle && ` · ${item.chapterTitle}`}
                    </span>
                    <span className="text-caption text-fg-muted">
                      {tOr(
                        'studio.clipSuggestionLost',
                        {
                          share: unwrapOr(
                            format({ type: 'percent', value: item.lostShare * PERCENT }),
                            ''
                          ),
                        },
                        ''
                      )}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={create.isPending && create.variables?.startMs === item.startMs}
                    onClick={() => clip(item)}
                  >
                    {tOr('studio.clipSuggestionCreate', { start }, '')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
