import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CaptionTrackView } from '@vp/api-contracts';
import { SectionError } from '@vp/components';
import { ErrorCodes } from '@vp/errors';
import { useT } from '@vp/intl-react';
import { captionsQueryOptions, transcriptQueryOptions, useApi } from '@vp/queries';
import { Button, Dialog, Skeleton, useToast } from '@vp/ui';
import { useState } from 'react';
import { VersionConflictDialog } from '#app/components/dialogs/version-conflict-dialog';
import { editCuesMutationOptions } from '#app/features/captions/api/caption-mutations';
import { useLanguageLabel } from '#app/features/captions/hooks/use-language-label';
import { hasCode } from '#app/features/captions/utils/caption-failures';
import { CueRows } from '../cue-rows/cue-rows';

export interface CueEditorDialogProps {
  videoId: string;
  track: CaptionTrackView;
  /** The version of the track when the creator opened the editor: what every save is checked against. */
  baseVersion: number;
  onRebase: (version: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Changes the text of a track's cues, sending only the cues that differ, against the version the list carries. */
export function CueEditorDialog({
  videoId,
  track,
  baseVersion,
  onRebase,
  open,
  onOpenChange,
}: CueEditorDialogProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { tOr } = useT();
  const languageLabel = useLanguageLabel();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [conflict, setConflict] = useState(false);
  const transcript = useQuery({
    ...transcriptQueryOptions(api, videoId, track.language),
    enabled: open,
  });
  const edit = useMutation(editCuesMutationOptions(api, videoId));

  const cues = transcript.data?.cues ?? [];
  const changed = cues
    .filter((cue) => drafts[cue.index] !== undefined && drafts[cue.index] !== cue.text)
    .map(({ index }) => ({ index, text: drafts[index] ?? '' }));

  const save = (version: number) => {
    if (track.language === null) return;
    edit.mutate(
      { language: track.language, version, cues: changed },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: tOr('studio.captionsEditorSaved', {}, '') });
          setDrafts({});
          onOpenChange(false);
        },
        onError: (error) => {
          if (hasCode(error, ErrorCodes.VERSION_CONFLICT)) setConflict(true);
          else toast({ tone: 'danger', title: tOr('studio.captionsEditorFailed', {}, '') });
        },
      }
    );
  };

  const latestVersion = async () => {
    const list = await queryClient.query({
      ...captionsQueryOptions(api, videoId),
      staleTime: 0,
    });
    return list.tracks.find(({ id }) => id === track.id)?.version;
  };

  const reload = async () => {
    const version = await latestVersion();
    if (version !== undefined) onRebase(version);
    await queryClient.invalidateQueries({
      queryKey: transcriptQueryOptions(api, videoId, track.language).queryKey,
    });
    setDrafts({});
    setConflict(false);
  };

  const overwrite = async () => {
    const version = await latestVersion();
    setConflict(false);
    if (version !== undefined) save(version);
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content size="lg">
          <Dialog.Header>
            <Dialog.Title>
              {tOr('studio.captionsEditorTitle', { language: languageLabel(track.language) }, '')}
            </Dialog.Title>
            <Dialog.Description>
              {tOr('studio.captionsEditorDescription', {}, '')}
            </Dialog.Description>
          </Dialog.Header>
          {transcript.isPending && <Skeleton className="h-32 w-full" />}
          {transcript.isError && (
            <SectionError.Root
              role="alert"
              retrying={transcript.isFetching}
              onRetry={() => void transcript.refetch()}
            >
              <SectionError.Message>
                {tOr('studio.captionsEditorLoadFailed', {}, '')}
              </SectionError.Message>
            </SectionError.Root>
          )}
          {transcript.isSuccess && cues.length === 0 && (
            <p className="m-0 text-body-sm text-fg-muted">
              {tOr('studio.captionsEditorEmpty', {}, '')}
            </p>
          )}
          {transcript.isSuccess && cues.length > 0 && (
            <CueRows
              cues={cues}
              drafts={drafts}
              onChange={(index, text) => setDrafts((current) => ({ ...current, [index]: text }))}
            />
          )}
          <Dialog.Footer>
            <Button
              variant="solid"
              tone="accent"
              loading={edit.isPending}
              disabled={changed.length === 0}
              onClick={() => save(baseVersion)}
            >
              {tOr('studio.captionsEditorSave', {}, '')}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
      <VersionConflictDialog
        open={conflict}
        onOpenChange={setConflict}
        onReload={() => void reload()}
        onOverwrite={() => void overwrite()}
      />
    </>
  );
}
