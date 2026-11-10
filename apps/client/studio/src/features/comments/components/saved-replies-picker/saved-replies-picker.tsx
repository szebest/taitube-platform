import { useQuery } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { savedRepliesQueryOptions, useApi } from '@vp/queries';
import { Button, Popover, Spinner } from '@vp/ui';
import { useState } from 'react';

export interface SavedRepliesPickerProps {
  /** Takes the body of the reply picked, to put in the draft where it can still be edited. */
  onPick: (body: string) => void;
}

/** The channel's saved replies in a popover: pick one and it lands in the reply, which is still the creator's to edit before it is sent. */
export function SavedRepliesPicker({ onPick }: SavedRepliesPickerProps) {
  const { tOr } = useT();
  const [open, setOpen] = useState(false);
  const replies = useQuery({ ...savedRepliesQueryOptions(useApi()), enabled: open });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm">
          {tOr('studio.repliesPick', {}, '')}
        </Button>
      </Popover.Trigger>
      <Popover.Content align="start" aria-label={tOr('studio.repliesPickLabel', {}, '')}>
        {replies.isPending && <Spinner />}
        {replies.isSuccess && replies.data.length === 0 && (
          <p className="m-0 text-body-sm text-fg-muted">{tOr('studio.repliesPickEmpty', {}, '')}</p>
        )}
        <ul className="m-0 flex list-none flex-col gap-inline p-0">
          {replies.data?.map(({ id, title, body }) => (
            <li key={id}>
              <Popover.Close asChild>
                <button
                  type="button"
                  className="m-0 flex w-full cursor-pointer flex-col gap-0 rounded-control border-0 bg-transparent p-inset-control text-start hover:bg-tint focus-ring"
                  onClick={() => onPick(body)}
                >
                  <span className="text-label">{title}</span>
                  <span className="line-clamp-2 text-body-sm text-fg-muted">{body}</span>
                </button>
              </Popover.Close>
            </li>
          ))}
        </ul>
      </Popover.Content>
    </Popover.Root>
  );
}
