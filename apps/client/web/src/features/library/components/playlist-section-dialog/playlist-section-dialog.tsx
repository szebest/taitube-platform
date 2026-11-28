import { useAppForm } from '@kit/forms';
import { isErr } from '@kit/result';
import { Button, useToast } from '@kit/ui';
import type { PlaylistView } from '@vp/api-contracts';
import { PLAYLIST_SECTION_TITLE_MAX_LENGTH, validateSectionTitle } from '@vp/validation';
import { useAddPlaylistSection } from '#app/features/library/hooks/use-add-playlist-section';
import { useEditPlaylistItem } from '#app/features/library/hooks/use-edit-playlist-item';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

const { UrlModal, useUrlModal } = urlModals;

export interface PlaylistSectionDialogProps {
  playlist: PlaylistView;
}

function SectionForm({
  playlistId,
  section,
}: {
  playlistId: string;
  section: { id: string; title: string } | null;
}) {
  const { tOr } = useT();
  const showToast = useToast();
  const { close } = useUrlModal('playlist-section');
  const add = useAddPlaylistSection(playlistId);
  const rename = useEditPlaylistItem(playlistId);

  const saved = () => {
    showToast({ tone: 'success', title: tOr('playlistEdit.sectionSaved', {}, '') });
    close();
  };

  const validateTitle = ({ value }: { value: string }) =>
    isErr(validateSectionTitle(value))
      ? tOr('playlistEdit.sectionTitleInvalid', { max: PLAYLIST_SECTION_TITLE_MAX_LENGTH }, '')
      : undefined;

  const form = useAppForm({
    defaultValues: { title: section?.title ?? '' },
    onSubmit: ({ value: { title } }) =>
      section
        ? rename.mutate({ kind: 'section', itemId: section.id, title }, { onSuccess: saved })
        : add.mutate(title, { onSuccess: saved }),
  });

  return (
    <form
      className="flex flex-col gap-stack"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="title" validators={{ onMount: validateTitle, onChange: validateTitle }}>
        {(field) => <field.TextField label={tOr('playlistEdit.sectionTitleLabel', {}, '')} />}
      </form.AppField>
      <UrlModal.Footer>
        <UrlModal.Close asChild>
          <Button type="button" variant="ghost">
            {tOr('ui.cancel', {}, '')}
          </Button>
        </UrlModal.Close>
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              type="submit"
              variant="solid"
              tone="accent"
              loading={add.isPending || rename.isPending}
              disabled={!canSubmit}
            >
              {tOr('playlistEdit.save', {}, '')}
            </Button>
          )}
        </form.Subscribe>
      </UrlModal.Footer>
    </form>
  );
}

/** `?modal=playlist-section[&sectionId=]`: a new section's title, or a new title for one. */
export function PlaylistSectionDialog({ playlist }: PlaylistSectionDialogProps) {
  const { tOr } = useT();
  const { params } = useUrlModal('playlist-section');
  const sectionId = params?.sectionId;
  const section = playlist.sections.find(({ id }) => id === sectionId) ?? null;
  const missing = sectionId !== undefined && section === null;

  return (
    <UrlModal.Root id="playlist-section">
      <UrlModal.Content>
        <UrlModal.Title>
          {tOr('playlistEdit.sectionDialogTitle', { mode: sectionId ? 'rename' : 'add' }, '')}
        </UrlModal.Title>
        <UrlModal.Description>
          {tOr(missing ? 'playlistEdit.itemMissing' : 'playlistEdit.sectionDialogBody', {}, '')}
        </UrlModal.Description>
        <UrlModal.Body>
          {params && !missing && (
            <SectionForm key={sectionId ?? 'new'} playlistId={playlist.id} section={section} />
          )}
        </UrlModal.Body>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
