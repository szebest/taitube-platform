import { EmptyState } from '@kit/components';
import { isErr } from '@kit/result';
import { Button, Callout, useToast } from '@kit/ui';
import { useMutation } from '@tanstack/react-query';
import type { Video, VideoGenerationsView } from '@vp/api-contracts';
import { BLUR_MIN_MS, type BlurRegion, TRIM_MIN_MS, type TimeRange } from '@vp/domain';
import { VIDEO_EDIT, decideVideoEdit } from '@vp/domain-rules';
import { useApi } from '@vp/queries';
import { useState } from 'react';
import { TimelineRangeEditor } from '#app/components/video/timeline-range-editor';
import {
  revertEditsMutationOptions,
  saveEditsMutationOptions,
} from '#app/features/videos/api/video-pipeline-mutations';
import { useT } from '#app/lib/messages';
import { formatTimecode } from '#app/utils/timecode';
import { BlurFields } from '../blur-fields/blur-fields';

const NEW_BLUR_MS = 5_000;
const NEW_BLUR_STRENGTH = 10;

export interface TrimBlurEditorProps {
  video: Video;
  generations: VideoGenerationsView;
  /** A replacement or an edit is in flight, so nothing new can be saved. */
  busy: boolean;
}

const keyed = (blur: BlurRegion) => ({ key: crypto.randomUUID(), blur });

function newBlur(durationMs: number): BlurRegion {
  const endMs = Math.min(NEW_BLUR_MS, durationMs);
  return {
    startMs: 0,
    endMs,
    shape: 'rect',
    x: 0.4,
    y: 0.4,
    w: 0.2,
    h: 0.2,
    strength: NEW_BLUR_STRENGTH,
  };
}

/**
 * The edit list over the base generation's timeline: one range to keep and the blurred regions, each
 * edited one at a time on the sprite frames, then saved as a render, or reverted to the base.
 */
export function TrimBlurEditor({ video, generations, busy }: TrimBlurEditorProps) {
  const api = useApi();
  const toast = useToast();
  const { tOr } = useT();
  const save = useMutation(saveEditsMutationOptions(api, video.id));
  const revert = useMutation(revertEditsMutationOptions(api, video.id));
  const { edit, editBase, activeGeneration } = generations;
  const durationMs = editBase.durationMs;
  const [trim, setTrim] = useState<TimeRange>(edit?.trim ?? { startMs: 0, endMs: durationMs });
  const [rows, setRows] = useState(() => (edit?.blurs ?? []).map(keyed));
  const blurs = rows.map(({ blur }) => blur);
  const [selected, setSelected] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const editing = selected === null ? undefined : blurs[selected];
  const revertible =
    edit !== null &&
    VIDEO_EDIT.sources('revert').includes(edit.status) &&
    edit.generation === activeGeneration &&
    edit.baseGeneration !== edit.generation;

  const time = (range: TimeRange) => ({
    start: formatTimecode(range.startMs),
    end: formatTimecode(range.endMs),
  });

  const replaceBlur = (index: number, blur: BlurRegion) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, blur } : row)));

  const removeBlur = (index: number) => {
    setRows((current) => current.filter((_, at) => at !== index));
    setSelected(null);
  };

  const submit = () => {
    const whole = trim.startMs === 0 && trim.endMs === durationMs;
    const decided = decideVideoEdit({ trim: whole ? null : trim, blurs }, { durationMs });
    if (isErr(decided)) {
      setProblem(tOr('studio.editsInvalid', {}, ''));
      return;
    }
    setProblem(null);
    save.mutate(decided.value, {
      onSuccess: () => toast({ tone: 'success', title: tOr('studio.editsSaved', {}, '') }),
      onError: () => toast({ tone: 'danger', title: tOr('studio.editsSaveFailed', {}, '') }),
    });
  };

  const undo = () =>
    revert.mutate(video.version, {
      onSuccess: () => toast({ tone: 'success', title: tOr('studio.editsReverted', {}, '') }),
      onError: () => toast({ tone: 'danger', title: tOr('studio.editsRevertFailed', {}, '') }),
    });

  return (
    <section className="flex flex-col gap-stack" aria-labelledby="trim-blur-title">
      <h3 id="trim-blur-title">{tOr('studio.trimTitle', {}, '')}</h3>
      <Callout.Root tone="info">
        <Callout.Icon />
        <Callout.Body>{tOr('studio.trimBaseNotice', {}, '')}</Callout.Body>
      </Callout.Root>
      {durationMs > 0 && (
        <TimelineRangeEditor
          aria-label={tOr('studio.trimTimelineLabel', {}, '')}
          durationMs={durationMs}
          sprite={video.sprite}
          markers={[]}
          summary={tOr('studio.trimSummary', time(trim), '')}
          control={{
            mode: 'range',
            range: trim,
            onRangeChange: setTrim,
            minSpanMs: TRIM_MIN_MS,
            maxSpanMs: durationMs,
            startLabel: tOr('studio.trimStartLabel', {}, ''),
            endLabel: tOr('studio.trimEndLabel', {}, ''),
          }}
        />
      )}
      <h4 className="m-0">{tOr('studio.blursTitle', {}, '')}</h4>
      {blurs.length === 0 ? (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.blursEmpty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      ) : (
        <ul
          aria-label={tOr('studio.blursListLabel', {}, '')}
          className="m-0 flex list-none flex-col gap-stack p-0"
        >
          {rows.map(({ key, blur }, index) => (
            <li key={key} className="flex items-center justify-between gap-stack">
              <span className="tabular-nums">
                {tOr('studio.blurRow', { shape: blur.shape, ...time(blur) }, '')}
              </span>
              <span className="flex gap-inline">
                <Button
                  variant="outline"
                  size="sm"
                  aria-pressed={index === selected}
                  onClick={() => setSelected(index)}
                >
                  {tOr('studio.blurEdit', time(blur), '')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => removeBlur(index)}>
                  {tOr('studio.blurRemove', time(blur), '')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing && selected !== null && durationMs > 0 && (
        <div className="flex flex-col gap-stack">
          <TimelineRangeEditor
            aria-label={tOr('studio.blurTimelineLabel', {}, '')}
            durationMs={durationMs}
            sprite={video.sprite}
            markers={[]}
            summary={tOr('studio.blurSummary', time(editing), '')}
            control={{
              mode: 'range',
              range: editing,
              onRangeChange: (range) => replaceBlur(selected, { ...editing, ...range }),
              minSpanMs: BLUR_MIN_MS,
              maxSpanMs: durationMs,
              startLabel: tOr('studio.blurStartLabel', {}, ''),
              endLabel: tOr('studio.blurEndLabel', {}, ''),
            }}
          />
          <BlurFields blur={editing} onChange={(blur) => replaceBlur(selected, blur)} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-stack">
        <Button
          variant="outline"
          disabled={durationMs <= 0}
          onClick={() => {
            setRows((current) => [...current, keyed(newBlur(durationMs))]);
            setSelected(rows.length);
          }}
        >
          {tOr('studio.blurAdd', {}, '')}
        </Button>
        <Button variant="solid" disabled={busy} loading={save.isPending} onClick={submit}>
          {tOr('studio.editsSave', {}, '')}
        </Button>
        {revertible && (
          <Button variant="outline" disabled={busy} loading={revert.isPending} onClick={undo}>
            {tOr('studio.editsRevert', {}, '')}
          </Button>
        )}
      </div>
      {problem && <p role="alert">{problem}</p>}
    </section>
  );
}
