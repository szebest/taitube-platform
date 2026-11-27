import { Button, Dialog } from '@kit/ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useT } from '#app/lib/messages';
import { ThreadPanelContext, useThreadPanel } from './thread-panel.context';

export interface ThreadPanelRootProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Serves the moment chip of the header. */
  onSeek: (seconds: number) => void;
  children: ReactNode;
}

/** A thread opened beside the video: a side panel with its moment, its text, its replies and the box to reply. */
export function ThreadPanelRoot({ open, onOpenChange, onSeek, children }: ThreadPanelRootProps) {
  return (
    <ThreadPanelContext value={{ seek: onSeek }}>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content
          data-slot="thread-panel"
          side="inline-end"
          aria-describedby={undefined}
          className="flex flex-col gap-stack"
        >
          {children}
        </Dialog.Content>
      </Dialog.Root>
    </ThreadPanelContext>
  );
}

/** The thread's title, which names the panel. */
export function ThreadPanelHeader(props: ComponentPropsWithRef<'div'>) {
  return <Dialog.Header data-slot="thread-panel-header" {...props} />;
}

export function ThreadPanelTitle(props: ComponentPropsWithRef<typeof Dialog.Title>) {
  return <Dialog.Title data-slot="thread-panel-title" {...props} />;
}

export interface ThreadPanelAnchorProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'onClick' | 'children'
> {
  seconds: number;
  /** The moment, already formatted for the viewer. */
  time: string;
}

/** The moment the thread is about, as a chip that seeks the player there. */
export function ThreadPanelAnchor({ seconds, time, ...props }: ThreadPanelAnchorProps) {
  const { seek } = useThreadPanel('Anchor');
  const { tOr } = useT();

  return (
    <Button
      data-slot="thread-panel-anchor"
      variant="soft"
      size="sm"
      className="self-start tabular-nums"
      aria-label={tOr('threads.jumpTo', { time }, '')}
      onClick={() => seek(seconds)}
      {...props}
    >
      {time}
    </Button>
  );
}

/** The thread's own text. */
export function ThreadPanelBody(props: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="thread-panel-body"
      {...props}
      className="m-0 text-body break-words whitespace-pre-line"
    />
  );
}

/** The region that holds the replies list. */
export function ThreadPanelReplies(props: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="thread-panel-replies"
      {...props}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
    />
  );
}

/** Where the reply is written, kept under the replies. */
export function ThreadPanelComposer(props: ComponentPropsWithRef<'div'>) {
  return <div data-slot="thread-panel-composer" {...props} className="flex flex-col gap-inline" />;
}
