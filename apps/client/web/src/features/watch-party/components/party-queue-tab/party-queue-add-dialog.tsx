import { Button, Dialog, Input } from '@kit/ui';
import { type FormEvent, useState } from 'react';
import { parseVideoId } from '#app/features/watch-party/utils/parse-video-id';
import { useT } from '#app/lib/messages';

interface PartyQueueAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (videoId: string) => void;
}

/** A pasted Taitube link or video ID, added to the queue. */
export function PartyQueueAddDialog({ open, onOpenChange, onAdd }: PartyQueueAddDialogProps) {
  const { tOr } = useT();
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const videoId = parseVideoId(text);
    setInvalid(videoId === null);
    if (videoId) {
      onAdd(videoId);
      setText('');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <form onSubmit={submit}>
          <Dialog.Header>
            <Dialog.Title>{tOr('party.queueAddTitle', {}, '')}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Input
              value={text}
              aria-label={tOr('party.queueAddLabel', {}, '')}
              aria-invalid={invalid || undefined}
              onChange={(event) => setText(event.target.value)}
            />
            {invalid && (
              <p role="alert" className="m-0 text-caption text-danger-ink">
                {tOr('party.queueAddInvalid', {}, '')}
              </p>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="submit" disabled={text.trim() === ''}>
              {tOr('party.queueAddSubmit', {}, '')}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
