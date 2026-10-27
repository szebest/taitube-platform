import { VisuallyHidden } from '@vp/ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useShortsPlayerFrame } from './shorts-player-frame.context';
import { shortsPlayerFrameStyles } from './shorts-player-frame.variants';

/** The column of actions: beside the frame, or over its inline end on compact. */
export function ShortsPlayerFrameActions({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { layout } = useShortsPlayerFrame('Actions');

  return (
    <div
      data-slot="shorts-player-frame-actions"
      className={shortsPlayerFrameStyles({ layout }).actions({ className })}
      {...props}
    />
  );
}

export interface ShortsPlayerFrameActionProps
  extends Omit<ComponentPropsWithRef<'button'>, 'onSelect'> {
  icon: ReactNode;
  /** The finished count shown under the icon; the action's words stay in its name. */
  count?: string;
  /** Makes the action a toggle: Like pressed takes the accent. */
  pressed?: boolean;
  onSelect: () => void;
}

export function ShortsPlayerFrameAction({
  icon,
  count,
  pressed,
  onSelect,
  className,
  children,
  ...props
}: ShortsPlayerFrameActionProps) {
  const { layout } = useShortsPlayerFrame('Action');
  const styles = shortsPlayerFrameStyles({ layout });

  return (
    <button
      type="button"
      data-slot="shorts-player-frame-action"
      aria-pressed={pressed}
      className={styles.action({ className })}
      onClick={onSelect}
      {...props}
    >
      <span aria-hidden="true" className={styles.disc()}>
        {icon}
      </span>
      {count === undefined ? (
        children
      ) : (
        <>
          <VisuallyHidden>{children}</VisuallyHidden> <span>{count}</span>
        </>
      )}
    </button>
  );
}
