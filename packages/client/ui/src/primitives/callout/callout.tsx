import { Slot } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import type { IconId } from '../../icons/inventory';
import { Icon, type IconProps } from '../icon';
import { CalloutContext, useCallout } from './callout.context';
import { calloutStyles } from './callout.variants';
import type { CalloutFill, CalloutTone } from './types';

const TONE_ICONS = {
  neutral: 'info',
  accent: 'info',
  success: 'check',
  warning: 'alert',
  danger: 'alert',
  info: 'info',
} satisfies Record<CalloutTone, IconId>;

export interface CalloutRootProps extends ComponentPropsWithRef<'div'> {
  variant?: CalloutFill;
  tone?: CalloutTone;
}

/** A message in the page flow; one that appears after load takes `role="status"`, or `"alert"` for danger. */
export function CalloutRoot({
  variant = 'soft',
  tone = 'accent',
  className,
  ...props
}: CalloutRootProps) {
  const shared = useMemo(() => ({ variant, tone }), [variant, tone]);

  return (
    <CalloutContext value={shared}>
      <div data-slot="callout" className={calloutStyles(shared).root({ className })} {...props} />
    </CalloutContext>
  );
}

export interface CalloutIconProps extends Omit<IconProps, 'name'> {
  /** The tone's own glyph by default. */
  name?: IconId;
}

export function CalloutIcon({ name, className, ...props }: CalloutIconProps) {
  const shared = useCallout('Icon');

  return (
    <Icon
      data-slot="callout-icon"
      name={name ?? TONE_ICONS[shared.tone]}
      className={calloutStyles(shared).icon({ className })}
      {...props}
    />
  );
}

export interface CalloutPartProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

export function CalloutTitle({ asChild = false, className, ...props }: CalloutPartProps) {
  const shared = useCallout('Title');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="callout-title"
      className={calloutStyles(shared).title({ className })}
      {...props}
    />
  );
}

export function CalloutBody({ asChild = false, className, ...props }: CalloutPartProps) {
  const shared = useCallout('Body');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="callout-body"
      className={calloutStyles(shared).body({ className })}
      {...props}
    />
  );
}

export function CalloutAction({ asChild = false, className, ...props }: CalloutPartProps) {
  const shared = useCallout('Action');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="callout-action"
      className={calloutStyles(shared).action({ className })}
      {...props}
    />
  );
}
