import { Button, Command, Popover } from '@kit/ui';
import { useState } from 'react';
import type { ShareTarget } from '#app/components/posts/post-composer';
import { useT } from '#app/lib/messages';

export interface ShareTargetPickerProps {
  label: string;
  value: ShareTarget | null;
  options: readonly ShareTarget[];
  onChange: (target: ShareTarget) => void;
  hasNextPage?: boolean;
  fetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

/** What a post shares, picked from a searchable list; the name of the pick stays beside the button. */
export function ShareTargetPicker({
  label,
  value,
  options,
  onChange,
  hasNextPage = false,
  fetchingNextPage = false,
  onLoadMore,
}: ShareTargetPickerProps) {
  const { tOr } = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-stack" role="group" aria-label={label}>
      <span className="text-label">{label}</span>
      <span className="min-w-0 truncate text-fg-muted">
        {value?.title ?? tOr('studio.composerShareNone', {}, '')}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button variant="outline">
            {tOr(value ? 'studio.composerShareChange' : 'studio.composerShareChoose', {}, '')}
          </Button>
        </Popover.Trigger>
        <Popover.Content align="start" className="p-0">
          <Command.Root aria-label={label}>
            <Command.Input placeholder={tOr('studio.composerShareSearch', {}, '')} />
            <Command.List>
              <Command.Empty>{tOr('studio.composerShareEmpty', {}, '')}</Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.id}
                  value={option.id}
                  keywords={[option.title]}
                  onSelect={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  {option.title}
                </Command.Item>
              ))}
              {hasNextPage && (
                <Command.Item
                  value="more"
                  forceMount
                  disabled={fetchingNextPage}
                  onSelect={() => onLoadMore?.()}
                >
                  {tOr('studio.composerShareMore', {}, '')}
                </Command.Item>
              )}
            </Command.List>
          </Command.Root>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
