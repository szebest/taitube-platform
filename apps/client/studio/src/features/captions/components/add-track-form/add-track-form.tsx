import { useMutation } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Field, Input, useToast } from '@vp/ui';
import { useState } from 'react';
import { uploadTrackMutationOptions } from '../api/caption-mutations';
import { useLanguageLabel } from '../hooks/use-language-label';
import { fileIssueOf } from '../lib/caption-failures';
import { VttPicker } from './vtt-picker';

/** A track in a language the video has none in yet: its tag, then a `.vtt` file. */
export function AddTrackForm({ videoId, taken }: { videoId: string; taken: readonly string[] }) {
  const api = useApi();
  const toast = useToast();
  const { tOr } = useT();
  const languageLabel = useLanguageLabel();
  const [language, setLanguage] = useState('');
  const [issue, setIssue] = useState<string>();
  const upload = useMutation(uploadTrackMutationOptions(api, videoId));
  const tag = language.trim();
  const duplicate = taken.some((held) => held.toLowerCase() === tag.toLowerCase());
  const shown = duplicate
    ? tOr('studio.captionsLanguageTaken', { language: languageLabel(tag) }, '')
    : issue;

  const add = (vtt: string) => {
    setIssue(undefined);
    upload.mutate(
      { language: tag, vtt },
      {
        onSuccess: () => {
          setLanguage('');
          toast({ tone: 'success', title: tOr('studio.captionsUploaded', {}, '') });
        },
        onError: (error) =>
          setIssue(fileIssueOf(error) ?? tOr('studio.captionsUploadFailed', {}, '')),
      }
    );
  };

  return (
    <div className="flex flex-col gap-inline">
      <h3 className="m-0 text-label">{tOr('studio.captionsAddTitle', {}, '')}</h3>
      <Field.Root invalid={shown !== undefined}>
        <Field.Label>{tOr('studio.captionsLanguageLabel', {}, '')}</Field.Label>
        <Input value={language} onChange={(event) => setLanguage(event.target.value)} />
        <Field.Hint>{tOr('studio.captionsLanguageHint', {}, '')}</Field.Hint>
        {shown !== undefined && <Field.Error>{shown}</Field.Error>}
      </Field.Root>
      {tag !== '' && !duplicate && (
        <div>
          <VttPicker
            label={tOr('studio.captionsChooseFile', {}, '')}
            onText={add}
            onTooLarge={() => setIssue(tOr('studio.captionsFileTooLarge', {}, ''))}
          />
        </div>
      )}
    </div>
  );
}
