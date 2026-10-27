import { Icon, IconButton, Popover, Slider, Switch, useUiCopy } from '@vp/ui';
import { type ComponentPropsWithRef, useId } from 'react';

import { useLiveChat } from './live-chat.context';
import { liveChatStyles } from './live-chat.variants';

export const DEFAULT_OPACITY = 85;

/** The options menu: reading new messages aloud, and what the caller adds (the overlay's opacity). */
export function LiveChatMenu({ className, children, ...props }: ComponentPropsWithRef<'div'>) {
  const { layout, announce, setAnnounce } = useLiveChat('Menu');
  const { chatOptions, chatAnnounce } = useUiCopy();
  const announceId = useId();
  const styles = liveChatStyles({ layout });

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton size="sm" aria-label={chatOptions} className="tw:ms-auto">
          <Icon name="more" />
        </IconButton>
      </Popover.Trigger>
      <Popover.Content size="sm" side="block-end" align="end">
        <div data-slot="live-chat-menu" className={styles.menu({ className })} {...props}>
          <div className={styles.menuRow()}>
            <label htmlFor={announceId}>{chatAnnounce}</label>
            <Switch id={announceId} checked={announce} onCheckedChange={setAnnounce} />
          </div>
          {children}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

/** The overlay's ground opacity, 30 to 100 %; renders nothing when the chat is docked. */
export function LiveChatOpacity({ className }: { className?: string }) {
  const { layout, opacity, setOpacity } = useLiveChat('Opacity');
  const { chatOpacity } = useUiCopy();
  const labelId = useId();

  if (layout !== 'overlay') {
    return null;
  }

  return (
    <div
      className={liveChatStyles().menuRow({
        className: ['tw:flex-col tw:items-stretch', className],
      })}
    >
      <span id={labelId}>{chatOpacity}</span>
      <Slider.Root
        min={30}
        max={100}
        step={5}
        value={[opacity]}
        onValueChange={([next]) => setOpacity(next ?? DEFAULT_OPACITY)}
      >
        <Slider.Thumb aria-labelledby={labelId} />
      </Slider.Root>
    </div>
  );
}
