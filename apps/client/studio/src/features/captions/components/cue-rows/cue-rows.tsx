import type { TranscriptView } from '@vp/api-contracts';
import { videoDuration } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import { Input } from '@vp/ui';
import { useCueWindow } from '#app/features/captions/hooks/use-cue-window';

export interface CueRowsProps {
  cues: TranscriptView['cues'];
  drafts: Readonly<Record<number, string>>;
  onChange: (index: number, text: string) => void;
}

/** Every cue as a row with its text editable and its timing as it was generated, mounting only the rows in view. */
export function CueRows({ cues, drafts, onChange }: CueRowsProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const { scrollerRef, rows, totalSize } = useCueWindow(cues.length);

  return (
    <div ref={scrollerRef} className="max-h-[60vh] overflow-auto">
      <ul className="relative m-0 list-none p-0" style={{ height: totalSize }}>
        {rows.map(({ index: row, key, start, size }) => {
          const cue = cues[row];
          if (cue === undefined) return null;
          return (
            <li
              key={key}
              className="absolute inset-x-0 flex items-center gap-stack"
              style={{ height: size, transform: `translateY(${start}px)` }}
            >
              <span className="w-16 shrink-0 text-caption text-fg-muted tabular-nums">
                {unwrapOr(format(videoDuration(cue.startMs / 1000)), '')}
              </span>
              <Input
                aria-label={tOr('studio.captionsCueLabel', { number: cue.index + 1 }, '')}
                value={drafts[cue.index] ?? cue.text}
                onChange={(event) => onChange(cue.index, event.target.value)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
