import { Button, Icon } from '@kit/ui';
import { useExportPlaylist } from '#app/features/library/hooks/use-export-playlist';
import { useT } from '#app/lib/messages';

const FORMATS = ['json', 'csv'] as const;

export interface ExportPanelProps {
  playlistId: string;
}

/** The playlist as a JSON or CSV file, downloaded in the browser. */
export function ExportPanel({ playlistId }: ExportPanelProps) {
  const { tOr } = useT();
  const exporting = useExportPlaylist(playlistId);

  return (
    <div className="flex flex-col gap-stack">
      <p className="m-0 text-fg-muted">{tOr('playlistEdit.exportBody', {}, '')}</p>
      <div className="flex flex-wrap gap-inline">
        {FORMATS.map((format) => (
          <Button
            key={format}
            variant="outline"
            loading={exporting.isPending && exporting.variables === format}
            disabled={exporting.isPending}
            onClick={() => exporting.mutate(format)}
          >
            <Icon name="save" />
            {tOr('playlistEdit.exportAs', { format }, '')}
          </Button>
        ))}
      </div>
    </div>
  );
}
