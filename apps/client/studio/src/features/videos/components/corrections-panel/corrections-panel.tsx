import { useT } from '@kit/intl-react';
import { isErr } from '@kit/result';
import { Button, Input, Skeleton, useToast } from '@kit/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Video } from '@vp/api-contracts';
import { EmptyState } from '@vp/components';
import { decideCorrection } from '@vp/domain-rules';
import { correctionsQueryOptions, useApi } from '@vp/queries';
import { useState } from 'react';
import {
  addCorrectionMutationOptions,
  removeCorrectionMutationOptions,
} from '#app/features/videos/api/video-tool-mutations';
import { formatTimecode, parseTimecode } from '#app/utils/timecode';

/** The cards laid over the player: each a range of the video and a line of text. */
export function CorrectionsPanel({ video }: { video: Video }) {
  const api = useApi();
  const toast = useToast();
  const { tOr } = useT();
  const corrections = useQuery(correctionsQueryOptions(api, video.id));
  const add = useMutation(addCorrectionMutationOptions(api, video.id));
  const remove = useMutation(removeCorrectionMutationOptions(api, video.id));
  const [start, setStart] = useState('0:00');
  const [end, setEnd] = useState('0:05');
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const items = corrections.data?.items ?? [];

  const submit = () => {
    const startMs = parseTimecode(start);
    const endMs = parseTimecode(end);
    const decided =
      startMs === null || endMs === null
        ? null
        : decideCorrection(
            { startMs, endMs, text },
            { videoId: video.id, durationMs: video.durationMs ?? null, existing: items.length }
          );
    if (decided === null || isErr(decided)) {
      setProblem(tOr('studio.correctionsInvalid', {}, ''));
      return;
    }
    setProblem(null);
    add.mutate(decided.value, {
      onSuccess: () => {
        setText('');
        toast({ tone: 'success', title: tOr('studio.correctionsAdded', {}, '') });
      },
      onError: () => toast({ tone: 'danger', title: tOr('studio.correctionsAddFailed', {}, '') }),
    });
  };

  return (
    <section className="flex flex-col gap-stack" aria-labelledby="corrections-title">
      <header className="flex flex-col gap-inline">
        <h2 id="corrections-title">{tOr('studio.correctionsTitle', {}, '')}</h2>
        <p className="text-fg-muted">{tOr('studio.correctionsDescription', {}, '')}</p>
      </header>
      {corrections.isPending && <Skeleton className="h-24 w-full" />}
      {corrections.isError && <p role="alert">{tOr('studio.correctionsLoadFailed', {}, '')}</p>}
      {corrections.isSuccess && items.length === 0 && (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.correctionsEmpty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      )}
      {items.length > 0 && (
        <ul
          aria-label={tOr('studio.correctionsListLabel', {}, '')}
          className="m-0 flex list-none flex-col gap-stack p-0"
        >
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-stack">
              <span>
                <span className="text-caption text-fg-muted tabular-nums">
                  {formatTimecode(item.startMs)} - {formatTimecode(item.endMs)}
                </span>{' '}
                {item.text}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(item.id, {
                    onSuccess: () =>
                      toast({ tone: 'success', title: tOr('studio.correctionsRemoved', {}, '') }),
                    onError: () =>
                      toast({
                        tone: 'danger',
                        title: tOr('studio.correctionsRemoveFailed', {}, ''),
                      }),
                  })
                }
              >
                {tOr('studio.correctionsRemove', { start: formatTimecode(item.startMs) }, '')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-stack">
        <Input
          className="w-24"
          aria-label={tOr('studio.correctionsStartLabel', {}, '')}
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
        <Input
          className="w-24"
          aria-label={tOr('studio.correctionsEndLabel', {}, '')}
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
        <Input
          aria-label={tOr('studio.correctionsTextLabel', {}, '')}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button variant="solid" loading={add.isPending} onClick={submit}>
          {tOr('studio.correctionsAdd', {}, '')}
        </Button>
      </div>
      {problem && <p role="alert">{problem}</p>}
    </section>
  );
}
