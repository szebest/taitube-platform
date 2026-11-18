import { useT } from '@kit/intl-react';
import { isErr } from '@kit/result';
import { Button, Input, useToast } from '@kit/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Video } from '@vp/api-contracts';
import { CHAPTER_MIN_GAP_MS } from '@vp/domain';
import { validateChapters } from '@vp/domain-rules';
import { useApi, videoQueryOptions } from '@vp/queries';
import { useState } from 'react';
import { VersionConflictDialog } from '#app/components/dialogs/version-conflict-dialog';
import { isVersionConflict } from '#app/features/videos/api/is-version-conflict';
import {
  replaceChaptersMutationOptions,
  suggestChaptersMutationOptions,
} from '#app/features/videos/api/video-tool-mutations';
import { formatTimecode, parseTimecode } from '#app/utils/timecode';

interface Row {
  key: number;
  time: string;
  title: string;
}

const rowsOf = (chapters: readonly { startMs: number; title: string }[]): Row[] =>
  chapters.map(({ startMs, title }, key) => ({ key, time: formatTimecode(startMs), title }));

/** The chapters of one video as rows of a start and a title, saved as a whole against its version. */
export function ChaptersPanel({ video }: { video: Video }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { tOr } = useT();
  const [rows, setRows] = useState(() => rowsOf(video.chapters));
  const [nextKey, setNextKey] = useState(video.chapters.length);
  const [problem, setProblem] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const replace = useMutation(replaceChaptersMutationOptions(api, video.id));
  const suggest = useMutation(suggestChaptersMutationOptions(api, video.id));

  const change = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const add = () => {
    const last = rows.at(-1);
    const start = (parseTimecode(last?.time ?? '') ?? -CHAPTER_MIN_GAP_MS) + 3 * CHAPTER_MIN_GAP_MS;
    setRows((current) => [
      ...current,
      { key: nextKey, time: formatTimecode(Math.max(0, start)), title: '' },
    ]);
    setNextKey(nextKey + 1);
  };

  const fill = () =>
    suggest.mutate(undefined, {
      onSuccess: ({ items }) => {
        if (items.length === 0) {
          toast({ tone: 'warning', title: tOr('studio.chaptersSuggestEmpty', {}, '') });
          return;
        }
        setRows(rowsOf(items));
        setNextKey(items.length);
        toast({ tone: 'success', title: tOr('studio.chaptersSuggested', {}, '') });
      },
      onError: () => toast({ tone: 'danger', title: tOr('studio.chaptersSuggestFailed', {}, '') }),
    });

  const save = (version: number) => {
    const parsed = rows.map(({ time, title }) => ({ startMs: parseTimecode(time), title }));
    if (parsed.some(({ startMs }) => startMs === null)) {
      setProblem(tOr('studio.chaptersBadTime', {}, ''));
      return;
    }
    const checked = validateChapters(
      parsed.map(({ startMs, title }) => ({ startMs: startMs ?? 0, title }))
    );
    if (isErr(checked)) {
      setProblem(tOr('studio.chaptersInvalid', { reason: checked.error.message }, ''));
      return;
    }
    setProblem(null);
    replace.mutate(
      { chapters: checked.value, version },
      {
        onSuccess: (updated) => {
          setRows(rowsOf(updated.chapters));
          toast({ tone: 'success', title: tOr('studio.chaptersSaved', {}, '') });
        },
        onError: (error) => {
          if (isVersionConflict(error)) {
            setConflict(true);
            return;
          }
          toast({ tone: 'danger', title: tOr('studio.chaptersSaveFailed', {}, '') });
        },
      }
    );
  };

  const latest = () => queryClient.query({ ...videoQueryOptions(api, video.id), staleTime: 0 });

  const reload = async () => {
    const reloaded = await latest();
    setRows(rowsOf(reloaded.chapters));
    setConflict(false);
  };

  const overwrite = async () => {
    const { version } = await latest();
    setConflict(false);
    save(version);
  };

  return (
    <section className="flex flex-col gap-stack" aria-labelledby="chapters-title">
      <header className="flex flex-col gap-inline">
        <h2 id="chapters-title">{tOr('studio.chaptersTitle', {}, '')}</h2>
        <p className="text-fg-muted">{tOr('studio.chaptersDescription', {}, '')}</p>
      </header>
      {rows.length === 0 && <p>{tOr('studio.chaptersEmpty', {}, '')}</p>}
      <ol className="m-0 flex list-none flex-col gap-stack p-0">
        {rows.map((row, index) => (
          <li key={row.key} className="flex items-center gap-stack">
            <Input
              className="w-24"
              aria-label={tOr('studio.chaptersTimeLabel', { number: index + 1 }, '')}
              value={row.time}
              onChange={(event) => change(row.key, { time: event.target.value })}
            />
            <Input
              aria-label={tOr('studio.chaptersTitleLabel', { number: index + 1 }, '')}
              value={row.title}
              onChange={(event) => change(row.key, { title: event.target.value })}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRows((current) => current.filter(({ key }) => key !== row.key))}
            >
              {tOr('studio.chaptersRemove', { number: index + 1 }, '')}
            </Button>
          </li>
        ))}
      </ol>
      {problem && <p role="alert">{problem}</p>}
      <div className="flex flex-wrap gap-inline">
        <Button variant="outline" onClick={add}>
          {tOr('studio.chaptersAdd', {}, '')}
        </Button>
        <Button variant="outline" loading={suggest.isPending} onClick={fill}>
          {tOr('studio.chaptersSuggest', {}, '')}
        </Button>
        <Button variant="solid" loading={replace.isPending} onClick={() => save(video.version)}>
          {tOr('studio.chaptersSave', {}, '')}
        </Button>
      </div>
      <VersionConflictDialog
        open={conflict}
        onOpenChange={setConflict}
        onReload={reload}
        onOverwrite={overwrite}
      />
    </section>
  );
}
