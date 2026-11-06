import { useT } from '@vp/intl-react';
import { Button } from '@vp/ui';
import { useUploadDock } from '../upload-dock/upload-dock';

/** The toolbar's way into the upload dialog, on every page of the studio. */
export function UploadToolbarButton() {
  const { setDialogOpen } = useUploadDock('ToolbarButton');
  const { tOr } = useT();

  return (
    <Button size="sm" variant="solid" tone="accent" onClick={() => setDialogOpen(true)}>
      {tOr('studio.navUpload', {}, '')}
    </Button>
  );
}
