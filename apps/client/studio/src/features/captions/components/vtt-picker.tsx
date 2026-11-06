import { MAX_CAPTION_FILE_BYTES } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { Button } from '@vp/ui';
import type { ChangeEvent } from 'react';

export interface VttPickerProps {
  label: string;
  onFile: (file: File) => void;
  onTooLarge: () => void;
}

/** A button that opens the file chooser for one `.vtt` file, refusing one over the API's limit before it is read. */
export function VttPicker({ label, onFile, onTooLarge }: VttPickerProps) {
  const { tOr } = useT();

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;
    if (file.size > MAX_CAPTION_FILE_BYTES) onTooLarge();
    else onFile(file);
  };

  return (
    <Button asChild variant="outline" size="sm">
      <label>
        {label}
        <input
          type="file"
          accept=".vtt,text/vtt"
          className="sr-only"
          onChange={pick}
          aria-label={tOr('studio.captionsChooseFile', {}, '')}
        />
      </label>
    </Button>
  );
}
