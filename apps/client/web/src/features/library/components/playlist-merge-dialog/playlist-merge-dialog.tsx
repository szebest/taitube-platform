import { SectionError } from '@kit/components';
import { Button, Checkbox, Field, Input, Label, Skeleton, Switch } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import type { PlaylistItemResultView, PlaylistView } from '@vp/api-contracts';
import { PLAYLIST_MERGE_MAX_SOURCES } from '@vp/domain';
import { useApi } from '@vp/queries';
import { useState } from 'react';
import { myPlaylistsQueryOptions } from '#app/features/library/api/library-queries';
import { useMergePlaylists } from '#app/features/library/hooks/use-merge-playlists';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';
import { ItemResults } from '../item-results/item-results';

const { UrlModal } = urlModals;

type MergeTarget = 'current' | 'new';

export interface PlaylistMergeDialogProps {
  playlist: PlaylistView;
  /** The viewer may add to this playlist, so it can take the merge. */
  canMergeHere: boolean;
}

function MergeForm({ playlist, canMergeHere }: PlaylistMergeDialogProps) {
  const api = useApi();
  const { tOr } = useT();
  const { close } = urlModals.useUrlModal('playlist-merge');
  const playlists = useQuery(myPlaylistsQueryOptions(api));
  const merge = useMergePlaylists();
  const [sources, setSources] = useState<readonly string[]>([]);
  const [target, setTarget] = useState<MergeTarget>(canMergeHere ? 'current' : 'new');
  const [newTitle, setNewTitle] = useState('');
  const [deleteSources, setDeleteSources] = useState(false);
  const [results, setResults] = useState<readonly PlaylistItemResultView[] | null>(null);

  const full = sources.length >= PLAYLIST_MERGE_MAX_SOURCES;
  const ready = sources.length > 0 && (target === 'current' || newTitle.trim() !== '');

  const toggle = (id: string, picked: boolean) =>
    setSources((current) =>
      picked ? [...current, id] : current.filter((source) => source !== id)
    );

  const send = () =>
    merge.mutate(
      target === 'current'
        ? { kind: 'into', into: playlist.id, sourceIds: sources, deleteSources }
        : { kind: 'new', newTitle, sourceIds: sources, deleteSources },
      { onSuccess: (answer) => setResults(answer.results) }
    );

  if (results !== null) {
    return (
      <div className="flex flex-col gap-stack">
        <ItemResults mode="merge" results={results} titleOf={() => undefined} />
        <Button variant="solid" tone="accent" className="self-end" onClick={close}>
          {tOr('playlistEdit.done', {}, '')}
        </Button>
      </div>
    );
  }
  if (playlists.isError) {
    return (
      <SectionError.Root
        role="alert"
        retrying={playlists.isFetching}
        onRetry={() => void playlists.refetch()}
      >
        <SectionError.Message>{tOr('playlistEdit.targetsLoadFailed', {}, '')}</SectionError.Message>
      </SectionError.Root>
    );
  }
  if (playlists.isPending) return <Skeleton aria-hidden="true" className="h-24 w-full" />;

  const candidates = playlists.data.items.filter(
    ({ id, isSystem, isSmart }) => id !== playlist.id && !isSystem && !isSmart
  );

  return (
    <div className="flex flex-col gap-stack">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-label">{tOr('playlistEdit.mergeSourcesLabel', {}, '')}</legend>
        {candidates.length === 0 && (
          <p className="m-0 text-fg-muted">{tOr('playlistEdit.mergeNoSources', {}, '')}</p>
        )}
        {candidates.map(({ id, title }) => {
          const picked = sources.includes(id);
          return (
            <Label key={id} className="flex items-center gap-inline">
              <Checkbox
                checked={picked}
                disabled={full && !picked}
                onCheckedChange={(next) => toggle(id, next === true)}
              />
              <span className="min-w-0 truncate">{title}</span>
            </Label>
          );
        })}
      </fieldset>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-label">{tOr('playlistEdit.mergeTargetLabel', {}, '')}</legend>
        {(['current', 'new'] as const).map((option) => (
          <Label key={option} className="flex items-center gap-inline">
            <input
              type="radio"
              name="playlist-merge-target"
              className="size-4 accent-accent"
              checked={target === option}
              disabled={option === 'current' && !canMergeHere}
              onChange={() => setTarget(option)}
            />
            {tOr('playlistEdit.mergeTarget', { target: option }, '')}
          </Label>
        ))}
      </fieldset>
      {target === 'new' && (
        <Field.Root>
          <Field.Label>{tOr('playlistEdit.newTitleLabel', {}, '')}</Field.Label>
          <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
        </Field.Root>
      )}
      <Label className="flex items-center gap-inline">
        <Switch checked={deleteSources} onCheckedChange={setDeleteSources} />
        {tOr('playlistEdit.deleteSources', {}, '')}
      </Label>
      <Button
        variant="solid"
        tone="accent"
        className="self-end"
        disabled={!ready}
        loading={merge.isPending}
        onClick={send}
      >
        {tOr('playlistEdit.mergeAction', {}, '')}
      </Button>
    </div>
  );
}

/** `?modal=playlist-merge`: up to five of the viewer's playlists copied, in order, into this one or a new one. */
export function PlaylistMergeDialog(props: PlaylistMergeDialogProps) {
  const { tOr } = useT();
  const { isOpen } = urlModals.useUrlModal('playlist-merge');

  return (
    <UrlModal.Root id="playlist-merge">
      <UrlModal.Content>
        <UrlModal.Title>{tOr('playlistEdit.mergeTitle', {}, '')}</UrlModal.Title>
        <UrlModal.Description>
          {tOr('playlistEdit.mergeBody', { max: PLAYLIST_MERGE_MAX_SOURCES }, '')}
        </UrlModal.Description>
        <UrlModal.Body>{isOpen && <MergeForm {...props} />}</UrlModal.Body>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
