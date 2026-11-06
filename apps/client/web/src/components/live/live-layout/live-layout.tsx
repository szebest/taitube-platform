import type { ComponentPropsWithRef } from 'react';
import { LiveLayoutContext, useLiveLayout } from './live-layout.context';
import { liveLayoutStyles } from './live-layout.variants';
import type { LiveLayoutChatPlace } from './types';

export interface LiveLayoutRootProps extends ComponentPropsWithRef<'div'> {
  /** `overlay` leaves the chat to the player, as in fullscreen or for a vertical stream. */
  chat?: LiveLayoutChatPlace;
}

/** The `/live` page: the stage, the chat docked beside it from expanded up, the details under it. */
export function LiveLayoutRoot({ chat = 'docked', className, ...props }: LiveLayoutRootProps) {
  const shared = { chat };

  return (
    <LiveLayoutContext value={shared}>
      <div
        data-slot="live-layout"
        data-chat={chat}
        className={liveLayoutStyles({ chat }).root({ className })}
        {...props}
      />
    </LiveLayoutContext>
  );
}

export function LiveLayoutStage({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { chat } = useLiveLayout('Stage');

  return (
    <div
      data-slot="live-layout-stage"
      className={liveLayoutStyles({ chat }).stage({ className })}
      {...props}
    />
  );
}

/** The chat slot; renders nothing while the chat is an overlay inside the player. */
export function LiveLayoutChat({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { chat } = useLiveLayout('Chat');

  if (chat === 'overlay') {
    return null;
  }

  return (
    <div
      data-slot="live-layout-chat"
      className={liveLayoutStyles({ chat }).chat({ className })}
      {...props}
    />
  );
}

export function LiveLayoutDetails({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { chat } = useLiveLayout('Details');

  return (
    <div
      data-slot="live-layout-details"
      className={liveLayoutStyles({ chat }).details({ className })}
      {...props}
    />
  );
}
