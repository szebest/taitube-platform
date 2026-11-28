import { EmptyState, TimelineRangeEditor } from '@kit/components';
import { isErr } from '@kit/result';
import { Button, Input, Skeleton, useToast } from '@kit/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Video } from '@vp/api-contracts';
import { CORRECTION_MAX_MS, CORRECTION_MIN_MS } from '@vp/domain';
import { decideCorrection, decideCorrectionFields } from '@vp/domain-rules';
import { correctionsQueryOptions, useApi } from '@vp/queries';
import { useState } from 'react';
import {
  addCorrectionMutationOptions,
  removeCorrectionMutationOptions,
  updateCorrectionMutationOptions,
} from '#app/features/videos/api/video-tool-mutations';
import { useT } from '#app/lib/messages';
import { formatTimecode, parseTimecode } from '#app/utils/timecode';

/** The cards laid over the player: each a range of the video and a line of text. */
export function CorrectionsPanel({ video }: { video: Video }) {
  const api = useApi();
  const toast = useToast();
  const { tOr } = useT();
  const corrections = useQuery(correctionsQueryOptions(api, video.id));
  const add = useMutation(addCorrectionMutationOptions(api, video.id));
  const update = useMutation(updateCorrectionMutationOptions(api, video.id));
  const remove = useMutation(removeCorrectionMutationOptions(api, video.id));
  const [editing, setEditing] = useState<string | null>(null);
  const [start, setStart] = useState('0:00');
  const [end, setEnd] = useState('0:05');
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const items = corrections.data?.items ?? [];
  const durationMs = video.durationMs ?? 0;
  const startMs = parseTimecode(start);
  const endMs = parseTimecode(end);
  const markers = items.map(({ id, startMs: ms }) => ({
    id,
    ms,
    label: tOr('studio.correctionsMarkerLabel', { start: formatTimecode(ms) }, ''),
    active: id === editing,
  }));

  const reset = () => {
    setEditing(null);
    setText('');
    setProblem(null);
  };

  const edit = (item: (typeof items)[number]) => {
    setEditing(item.id);
    setStart(formatTimecode(item.startMs));
    setEnd(formatTimecode(item.endMs));
    setText(item.text);
    setProblem(null);
  };

  const removeCorrection = (id: string) =>
    remove.mutate(id, {
      onSuccess: () => {
        if (editing === id) reset();
        toast({ tone: 'success', title: tOr('studio.correctionsRemoved', {}, '') });
      },
      onError: () =>
        toast({ tone: 'danger', title: tOr('studio.correctionsRemoveFailed', {}, '') }),
    });

  const submit = () => {
    if (startMs === null || endMs === null) {
      setProblem(tOr('studio.correctionsInvalid', {}, ''));
      return;
    }
    const fields = { startMs, endMs, text };
    const decided = editing
      ? decideCorrectionFields(fields, { durationMs: video.durationMs ?? null })
      : decideCorrection(fields, {
          videoId: video.id,
          durationMs: video.durationMs ?? null,
          existing: items.length,
        });
    if (isErr(decided)) {
      setProblem(tOr('studio.correctionsInvalid', {}, ''));
      return;
    }
    setProblem(null);
    if (editing) {
      update.mutate(
        { correctionId: editing, changes: decided.value },
        {
          onSuccess: () => {
            reset();
            toast({ tone: 'success', title: tOr('studio.correctionsSaved', {}, '') });
          },
          onError: () =>
            toast({ tone: 'danger', title: tOr('studio.correctionsSaveFailed', {}, '') }),
        }
      );
      return;
    }
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
              <span className="flex gap-inline">
                <Button variant="outline" size="sm" onClick={() => edit(item)}>
                  {tOr('studio.correctionsEdit', { start: formatTimecode(item.startMs) }, '')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => removeCorrection(item.id)}
                >
                  {tOr('studio.correctionsRemove', { start: formatTimecode(item.startMs) }, '')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {durationMs > 0 && (
        <TimelineRangeEditor
          aria-label={tOr('studio.correctionsTimelineLabel', {}, '')}
          durationMs={durationMs}
          sprite={video.sprite}
          markers={markers}
          summary={tOr('studio.correctionsRangeSummary', { start, end }, '')}
          control={{
            mode: 'range',
            range: {
              startMs: Math.min(startMs ?? 0, durationMs),
              endMs: Math.min(endMs ?? 0, durationMs),
            },
            onRangeChange: (range) => {
              setStart(formatTimecode(range.startMs));
              setEnd(formatTimecode(range.endMs));
            },
            minSpanMs: CORRECTION_MIN_MS,
            maxSpanMs: CORRECTION_MAX_MS,
            startLabel: tOr('studio.correctionsStartLabel', {}, ''),
            endLabel: tOr('studio.correctionsEndLabel', {}, ''),
          }}
        />
      )}
      {editing && (
        <p className="m-0 text-fg-muted">
          {tOr(
            'studio.correctionsEditing',
            { start: formatTimecode(items.find(({ id }) => id === editing)?.startMs ?? 0) },
            ''
          )}
        </p>
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
        <Button variant="solid" loading={add.isPending || update.isPending} onClick={submit}>
          {editing ? tOr('studio.correctionsSave', {}, '') : tOr('studio.correctionsAdd', {}, '')}
        </Button>
        {editing && (
          <Button variant="outline" onClick={reset}>
            {tOr('studio.correctionsCancel', {}, '')}
          </Button>
        )}
      </div>
      {problem && <p role="alert">{problem}</p>}
    </section>
  );
}
