import { assertNever } from '@kit/result';
import { Button, Field, Label, SegmentedControl, Textarea } from '@kit/ui';
import type { PlaylistImportLineView } from '@vp/api-contracts';
import { PLAYLIST_IMPORT_MAX_BYTES, PLAYLIST_IMPORT_MAX_LINES } from '@vp/domain';
import { type ChangeEvent, useState } from 'react';
import { useImportPlaylist } from '#app/features/library/hooks/use-import-playlist';
import {
  type ImportCheck,
  type ImportFormat,
  checkImportContent,
  importFormatOf,
} from '#app/features/library/utils/import-content';
import { useT } from '#app/lib/messages';

const FORMATS = ['urls', 'json', 'csv'] as const satisfies readonly ImportFormat[];
const STATUSES = ['added', 'duplicate', 'not_found', 'unrecognised'] as const;

export interface ImportPanelProps {
  playlistId: string;
}

/** Pasted text or a picked file, checked against the limits here, then sent; the answer is one line per entry. */
export function ImportPanel({ playlistId }: ImportPanelProps) {
  const { tOr } = useT();
  const [format, setFormat] = useState<ImportFormat>('urls');
  const [content, setContent] = useState('');
  const [problem, setProblem] = useState<ImportCheck | null>(null);
  const [lines, setLines] = useState<readonly PlaylistImportLineView[] | null>(null);
  const send = useImportPlaylist(playlistId);

  const problemText = (check: ImportCheck): string | null => {
    switch (check.kind) {
      case 'ready':
        return null;
      case 'empty':
        return tOr('playlistEdit.importEmpty', {}, '');
      case 'tooLarge':
        return tOr('playlistEdit.importTooLarge', { max: PLAYLIST_IMPORT_MAX_BYTES }, '');
      case 'tooManyLines':
        return tOr(
          'playlistEdit.importTooManyLines',
          { count: check.lines, max: PLAYLIST_IMPORT_MAX_LINES },
          ''
        );
      default:
        return assertNever(check, 'ImportCheck');
    }
  };

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFormat(importFormatOf(file.name) ?? format);
    setContent(await file.text());
    setProblem(null);
  };

  const submit = () => {
    const check = checkImportContent(content, format);
    setProblem(check);
    if (check.kind !== 'ready') return;

    send.mutate({ format, content }, { onSuccess: (answer) => setLines(answer.lines) });
  };

  const shownProblem = problem && problemText(problem);

  return (
    <div className="flex flex-col gap-stack">
      <p className="m-0 text-fg-muted">{tOr('playlistEdit.importBody', {}, '')}</p>
      <SegmentedControl.Root
        aria-label={tOr('playlistEdit.formatLabel', {}, '')}
        value={format}
        onValueChange={(next) => setFormat(FORMATS.find((option) => option === next) ?? format)}
      >
        {FORMATS.map((option) => (
          <SegmentedControl.Item key={option} value={option}>
            {tOr('playlistEdit.format', { format: option }, '')}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
      <Field.Root invalid={shownProblem !== null}>
        <Field.Label>{tOr('playlistEdit.contentLabel', {}, '')}</Field.Label>
        <Textarea
          rows={6}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setProblem(null);
          }}
        />
        {shownProblem !== null && <Field.Error>{shownProblem}</Field.Error>}
      </Field.Root>
      <Label className="flex flex-col items-start gap-1">
        {tOr('playlistEdit.chooseFile', {}, '')}
        <input type="file" accept=".json,.csv,.txt" onChange={(event) => void pickFile(event)} />
      </Label>
      <Button
        variant="solid"
        tone="accent"
        className="self-end"
        loading={send.isPending}
        onClick={submit}
      >
        {tOr('playlistEdit.importAction', {}, '')}
      </Button>
      {lines !== null && (
        <section
          aria-label={tOr('playlistEdit.importResultsLabel', {}, '')}
          className="flex flex-col gap-inline"
        >
          <ul role="status" className="m-0 flex list-none flex-wrap gap-inline p-0">
            {STATUSES.map((status) => (
              <li key={status}>
                {tOr(
                  'playlistEdit.importCount',
                  { status, count: lines.filter((line) => line.status === status).length },
                  ''
                )}
              </li>
            ))}
          </ul>
          <ol className="m-0 flex max-h-64 list-none flex-col gap-1 overflow-y-auto p-0 text-body-sm">
            {lines.map(({ line, status }) => (
              <li key={line}>{tOr('playlistEdit.importLine', { row: line, status }, '')}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
