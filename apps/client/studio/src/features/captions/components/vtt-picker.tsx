import { MAX_CAPTION_FILE_BYTES } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { Button } from '@vp/ui';
import type { ChangeEvent } from 'react';

/** The body is sent as a JSON string, so that is the size the API's limit applies to. */
function sentBytes(vtt: string): number {
  return new TextEncoder().encode(JSON.stringify(vtt)).length;
}

export interface VttPickerProps {
  label: string;
  onText: (vtt: string) => void;
  onTooLarge: () => void;
}

/** A button that opens the file chooser for one `.vtt` file, refusing one whose request body would exceed the API's limit. */
export function VttPicker({ label, onText, onTooLarge }: VttPickerProps) {
  const { tOr } = useT();

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;
    const vtt = await file.text();
    if (sentBytes(vtt) > MAX_CAPTION_FILE_BYTES) onTooLarge();
    else onText(vtt);
  };

  return (
    <Button asChild variant="outline" size="sm">
      <label>
        {label}
        <input
          type="file"
          accept=".vtt,text/vtt"
          className="sr-only"
          onChange={(event) => void pick(event)}
          aria-label={tOr('studio.captionsChooseFile', {}, '')}
        />
      </label>
    </Button>
  );
}
