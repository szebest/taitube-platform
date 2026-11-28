import { Tabs } from '@kit/ui';
import { useNavigate } from '@tanstack/react-router';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';
import { ExportPanel } from './components/export-panel/export-panel';
import { ImportPanel } from './components/import-panel/import-panel';

const { UrlModal, useUrlModal } = urlModals;
const DIRECTIONS = ['import', 'export'] as const;

export interface PlaylistImportDialogProps {
  playlistId: string;
  /** The viewer may add to the playlist, so the Import tab is theirs. */
  canImport: boolean;
}

/** `?modal=playlist-import&direction=`: videos in from text or a file, or the playlist out as a file. */
export function PlaylistImportDialog({ playlistId, canImport }: PlaylistImportDialogProps) {
  const { tOr } = useT();
  const navigate = useNavigate();
  const { params } = useUrlModal('playlist-import');
  const direction = canImport ? (params?.direction ?? 'import') : 'export';

  const pickTab = (next: string) => {
    const picked = DIRECTIONS.find((option) => option === next);
    if (!picked) return;

    void navigate({
      to: '.',
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        direction: picked,
      })) as never,
      replace: true,
    });
  };

  return (
    <UrlModal.Root id="playlist-import">
      <UrlModal.Content>
        <UrlModal.Title>{tOr('playlistEdit.importTitle', {}, '')}</UrlModal.Title>
        <UrlModal.Description className="sr-only">
          {tOr('playlistEdit.importTabs', {}, '')}
        </UrlModal.Description>
        <UrlModal.Body>
          <Tabs.Root value={direction} onValueChange={pickTab} className="flex flex-col gap-stack">
            <Tabs.List aria-label={tOr('playlistEdit.importTabs', {}, '')}>
              {DIRECTIONS.filter((option) => canImport || option === 'export').map((option) => (
                <Tabs.Tab key={option} value={option}>
                  {tOr('playlistEdit.tab', { tab: option }, '')}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {canImport && (
              <Tabs.Panel value="import">
                <ImportPanel playlistId={playlistId} />
              </Tabs.Panel>
            )}
            <Tabs.Panel value="export">
              <ExportPanel playlistId={playlistId} />
            </Tabs.Panel>
          </Tabs.Root>
        </UrlModal.Body>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
