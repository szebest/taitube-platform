import { useT } from '@vp/intl-react';
import { IconButton } from '@vp/ui';
import { PictureInPicture2 } from 'lucide-react';

export interface PictureInPictureButtonProps {
  /** The browser has the API and the video has pictures to float: with `false` nothing is drawn. */
  available: boolean;
  active: boolean;
  onRequest: () => void;
  onExit: () => void;
}

/** The browser's own floating window for the picture, which keeps playing when the tab is left. */
export function PictureInPictureButton({
  available,
  active,
  onRequest,
  onExit,
}: PictureInPictureButtonProps) {
  const { tOr } = useT();

  if (!available) {
    return null;
  }

  return (
    <IconButton
      aria-label={tOr(active ? 'player.exitPictureInPicture' : 'player.pictureInPicture', {}, '')}
      aria-pressed={active}
      onClick={active ? onExit : onRequest}
    >
      <PictureInPicture2 aria-hidden="true" />
    </IconButton>
  );
}
