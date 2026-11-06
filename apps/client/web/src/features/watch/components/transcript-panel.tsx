import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { TranscriptView } from '@vp/api-contracts';
import { videoDuration } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { transcriptQueryOptions, useApi } from '@vp/queries';
import { Input } from '@vp/ui';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { usePlayerSeek, usePlayerTime } from '#app/features/player';
import { useDebouncedValue } from '#app/hooks/use-debounced-value';
import { useWindowRows } from '#app/hooks/use-window-rows';

const SEARCH_DELAY_MS = 300;

const MIN_SEARCH_LENGTH = 2;

/** How long after the viewer scrolls the list it stops following the playhead. */
const USER_SCROLL_GRACE_MS = 4000;

const ESTIMATED_CUE_HEIGHT = 44;

const MS_PER_SECOND = 1000;

type Cue = TranscriptView['cues'][number];

const NO_CUES: readonly Cue[] = [];

function findCueAt(cues: readonly Cue[], ms: number): number {
  return cues.findIndex(({ startMs, endMs }) => startMs <= ms && ms < endMs);
}

export interface TranscriptPanelProps {
  videoId: string;
  /** The language of the track to read; `null` reads the generated one. */
  language: string | null;
}

/**
 * The cues of a caption track beside the player: the one at the playhead highlighted and followed
 * unless the viewer is scrolling, a click seeking to a cue, and a search keeping only the cues that match.
 */
export function TranscriptPanel({ videoId, language }: TranscriptPanelProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const list = useRef<HTMLOListElement>(null);
  const lastUserScroll = useRef(0);

  const api = useApi();
  const { seek } = usePlayerSeek();
  const { tOr } = useT();
  const bodyId = useId();

  const settled = useDebouncedValue(query.trim(), SEARCH_DELAY_MS);
  const search = settled.length >= MIN_SEARCH_LENGTH ? settled : '';
  const { data, isError } = useQuery({
    ...transcriptQueryOptions(api, videoId, language, search),
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const cues = data?.cues ?? NO_CUES;
  const activeIndex = usePlayerTime((seconds) => findCueAt(cues, seconds * MS_PER_SECOND));
  const { rows, padding, measureRow } = useWindowRows({
    list,
    rowCount: cues.length,
    estimateRowHeight: ESTIMATED_CUE_HEIGHT,
    getRowKey: (row) => String(cues[row]?.index ?? row),
    scroller: list,
    pinned: activeIndex >= 0 ? [activeIndex] : [],
  });

  useEffect(() => {
    const scroller = list.current;
    if (
      !scroller ||
      activeIndex < 0 ||
      Date.now() - lastUserScroll.current < USER_SCROLL_GRACE_MS
    ) {
      return;
    }

    const row = scroller.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (!row) {
      return;
    }

    scroller.scrollTop = row.offsetTop - (scroller.clientHeight - row.offsetHeight) / 2;
  }, [activeIndex]);

  const markUserScroll = () => {
    lastUserScroll.current = Date.now();
  };

  return (
    <section
      aria-label={tOr('watch.transcript', {}, '')}
      className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between rounded-control border-0 bg-transparent p-0 text-start text-title focus-ring"
      >
        {tOr('watch.transcript', {}, '')}
        <ChevronDown
          aria-hidden="true"
          className="transition-transform motion-reduce:transition-none in-aria-expanded:rotate-180"
        />
      </button>
      {open && (
        <div id={bodyId} className="flex flex-col gap-2">
          <Input
            type="search"
            aria-label={tOr('watch.transcriptSearch', {}, '')}
            placeholder={tOr('watch.transcriptSearch', {}, '')}
            value={query}
            onChange={({ currentTarget }) => setQuery(currentTarget.value)}
          />
          {isError && <p className="m-0 text-body-sm">{tOr('watch.transcriptFailed', {}, '')}</p>}
          {search !== '' && data && cues.length === 0 && (
            <p className="m-0 text-body-sm text-fg-muted">
              {tOr('watch.transcriptNoMatches', { query: search }, '')}
            </p>
          )}
          <ol
            ref={list}
            onWheel={markUserScroll}
            onTouchMove={markUserScroll}
            onKeyDown={markUserScroll}
            style={padding}
            className="relative m-0 flex max-h-96 list-none flex-col overflow-y-auto p-0"
          >
            {rows.map(({ index, key, spaceBefore }) => {
              const cue = cues[index];
              if (!cue) {
                return null;
              }

              return (
                <li
                  key={key}
                  ref={measureRow}
                  data-index={index}
                  style={{ marginTop: spaceBefore }}
                >
                  <button
                    type="button"
                    aria-current={index === activeIndex || undefined}
                    onClick={() => seek(cue.startMs / MS_PER_SECOND)}
                    className="flex w-full gap-3 rounded-control border-0 bg-transparent px-2 py-1 text-start text-body-sm focus-ring hover:bg-tint aria-current:bg-accent-soft"
                  >
                    <span className="text-fg-muted tabular-nums">
                      <Format value={videoDuration(cue.startMs / MS_PER_SECOND)} />
                    </span>
                    {cue.text}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
