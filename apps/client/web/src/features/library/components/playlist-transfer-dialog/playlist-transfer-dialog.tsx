import { SectionError } from '@kit/components';
import { Button, Label, Skeleton } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import type { PlaylistItemResultView, PlaylistView } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { useState } from 'react';
import { myPlaylistsQueryOptions } from '#app/features/library/api/library-queries';
import { useTransferPlaylistItems } from '#app/features/library/hooks/use-transfer-playlist-items';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';
import { ItemResults } from '../item-results/item-results';

const { UrlModal, useUrlModal } = urlModals;

type TransferMode = 'move' | 'copy';

export interface PlaylistTransferDialogProps {
  playlist: PlaylistView;
  /** The item ids picked on the page. */
  selection: readonly string[];
  /** Called once the items have gone, so the page leaves selection mode. */
  onDone: () => void;
}

function TransferForm({
  playlist,
  selection,
  onDone,
  mode,
}: PlaylistTransferDialogProps & { mode: TransferMode }) {
  const api = useApi();
  const { tOr } = useT();
  const { close } = useUrlModal('playlist-transfer');
  const targets = useQuery(myPlaylistsQueryOptions(api));
  const transfer = useTransferPlaylistItems(playlist.id);
  const [picked] = useState(selection);
  const [target, setTarget] = useState<string | null>(null);
  const [results, setResults] = useState<readonly PlaylistItemResultView[] | null>(null);

  const titleOf = (itemId: string) =>
    playlist.items.find(({ id }) => id === itemId)?.video.title ?? undefined;

  const send = () => {
    if (target === null) return;

    transfer.mutate(
      { itemIds: picked, to: target, mode },
      {
        onSuccess: (answer) => {
          setResults(answer.results);
          onDone();
        },
      }
    );
  };

  const description = (
    <UrlModal.Description>
      {tOr('playlistEdit.transferBody', { count: picked.length }, '')}
    </UrlModal.Description>
  );

  if (results !== null) {
    return (
      <div className="flex flex-col gap-stack">
        {description}
        <ItemResults mode={mode} results={results} titleOf={titleOf} />
        <Button variant="solid" tone="accent" className="self-end" onClick={close}>
          {tOr('playlistEdit.done', {}, '')}
        </Button>
      </div>
    );
  }
  if (picked.length === 0) {
    return (
      <UrlModal.Description>{tOr('playlistEdit.nothingSelected', {}, '')}</UrlModal.Description>
    );
  }
  if (targets.isError) {
    return (
      <SectionError.Root
        role="alert"
        retrying={targets.isFetching}
        onRetry={() => void targets.refetch()}
      >
        <SectionError.Message>{tOr('playlistEdit.targetsLoadFailed', {}, '')}</SectionError.Message>
      </SectionError.Root>
    );
  }
  if (targets.isPending) return <Skeleton aria-hidden="true" className="h-24 w-full" />;

  return (
    <div className="flex flex-col gap-stack">
      {description}
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-label">{tOr('playlistEdit.targetsLabel', {}, '')}</legend>
        {targets.data.items
          .filter(({ id }) => id !== playlist.id)
          .map(({ id, title, isSmart }) => (
            <Label key={id} className="flex items-center gap-inline">
              <input
                type="radio"
                name="playlist-transfer-target"
                className="size-4 accent-accent"
                checked={target === id}
                disabled={isSmart}
                onChange={() => setTarget(id)}
              />
              <span className="min-w-0 truncate">{title}</span>
              {isSmart && (
                <span className="text-caption text-fg-muted">
                  {tOr('playlistEdit.smartTarget', {}, '')}
                </span>
              )}
            </Label>
          ))}
      </fieldset>
      <Button
        variant="solid"
        tone="accent"
        className="self-end"
        disabled={target === null}
        loading={transfer.isPending}
        onClick={send}
      >
        {tOr('playlistEdit.transferAction', { mode }, '')}
      </Button>
    </div>
  );
}

/** `?modal=playlist-transfer&transfer=move|copy`: the selected videos go to another playlist of the viewer's. */
export function PlaylistTransferDialog(props: PlaylistTransferDialogProps) {
  const { tOr } = useT();
  const { params } = useUrlModal('playlist-transfer');
  const mode = params?.transfer ?? 'move';

  return (
    <UrlModal.Root id="playlist-transfer">
      <UrlModal.Content>
        <UrlModal.Title>{tOr('playlistEdit.transferTitle', { mode }, '')}</UrlModal.Title>
        <UrlModal.Body>
          {params && <TransferForm key={mode} mode={mode} {...props} />}
        </UrlModal.Body>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
