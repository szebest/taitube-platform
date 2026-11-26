import { useT } from '@kit/intl-react';
import { Button, Field, Input, Progress, useToast } from '@kit/ui';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { useState } from 'react';
import { replaceFileMutationOptions } from '#app/features/videos/api/video-pipeline-mutations';

export interface ReplaceFileSectionProps {
  videoId: string;
  /** A replacement or an edit is in flight, so another cannot start. */
  busy: boolean;
}

/** Picks a new file, uploads it into a new generation and starts its render. */
export function ReplaceFileSection({ videoId, busy }: ReplaceFileSectionProps) {
  const api = useApi();
  const toast = useToast();
  const { tOr } = useT();
  const replace = useMutation(replaceFileMutationOptions(api, videoId));
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState(0);

  const submit = () => {
    if (!file) return;
    setUploaded(0);
    replace.mutate(
      { file, onProgress: setUploaded },
      {
        onSuccess: () => {
          setFile(null);
          toast({ tone: 'success', title: tOr('studio.replaceStarted', {}, '') });
        },
        onError: () => toast({ tone: 'danger', title: tOr('studio.replaceFailed', {}, '') }),
      }
    );
  };

  return (
    <section className="flex flex-col gap-stack" aria-labelledby="replace-file-title">
      <header className="flex flex-col gap-inline">
        <h3 id="replace-file-title">{tOr('studio.replaceTitle', {}, '')}</h3>
        <p className="m-0 text-fg-muted">{tOr('studio.replaceDescription', {}, '')}</p>
      </header>
      <div className="flex flex-wrap items-end gap-stack">
        <Field.Root className="min-w-0 flex-1 basis-60">
          <Field.Label>{tOr('studio.replaceFileLabel', {}, '')}</Field.Label>
          <Input
            type="file"
            accept="video/*"
            disabled={busy || replace.isPending}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Field.Root>
        <Button
          variant="solid"
          disabled={!file || busy}
          loading={replace.isPending}
          onClick={submit}
        >
          {tOr('studio.replaceStart', {}, '')}
        </Button>
      </div>
      {replace.isPending && (
        <Progress aria-label={tOr('studio.replaceUploading', {}, '')} value={uploaded} max={1} />
      )}
    </section>
  );
}
