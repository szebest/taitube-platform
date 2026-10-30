import {
  Button,
  type ButtonProps,
  Icon,
  IconButton,
  Slot,
  useUiCopy,
  VisuallyHidden,
} from '@vp/ui';
import { type ComponentPropsWithRef, useEffect, useEffectEvent, useState } from 'react';
import { OfflineStateContext, useOfflineState } from './offline-state.context';
import { offlineStateStyles } from './offline-state.variants';
import type { OfflineStateSize, OfflineStateTone } from './types';

const RECONNECTED_MS = 4000;

export interface OfflineStateRootProps extends ComponentPropsWithRef<'div'> {
  size?: OfflineStateSize;
  /** `success` is the reconnected confirmation, with `OfflineState.Reconnected` as its child. */
  tone?: OfflineStateTone;
  /** Checks the connection; while the promise it returns is pending, the retry shows a spinner. */
  onRetry: () => void | Promise<void>;
}

/** What still works without a connection, and a retry; the banner is a polite status. */
export function OfflineStateRoot({
  size = 'page',
  tone = 'neutral',
  onRetry,
  className,
  children,
  ...props
}: OfflineStateRootProps) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState('');
  const copy = useUiCopy();
  const styles = offlineStateStyles({ size, tone });
  const banner = size === 'banner';

  const retry = async () => {
    setChecking(true);
    setResult('');
    try {
      await onRetry();
    } finally {
      setChecking(false);
    }
    setResult(copy.stillOffline);
  };

  return (
    <OfflineStateContext value={{ size, tone, checking }}>
      <div
        data-slot="offline-state"
        data-size={size}
        data-tone={tone}
        role={banner ? 'status' : undefined}
        aria-live={banner ? 'polite' : undefined}
        className={styles.root({ className })}
        {...props}
      >
        <Icon name={tone === 'success' ? 'check' : 'wifi-off'} className={styles.icon()} />
        {children}
        {tone === 'neutral' && (
          <>
            {banner && (
              <IconButton
                aria-label={copy.retry}
                loading={checking}
                onClick={retry}
                className="tw:medium:hidden"
              >
                <Icon name="repeat" />
              </IconButton>
            )}
            <Button
              variant="soft"
              loading={checking}
              onClick={retry}
              className={banner ? 'tw:hidden tw:medium:inline-flex' : undefined}
            >
              {copy.retry}
            </Button>
            <VisuallyHidden role={banner ? undefined : 'status'}>{result}</VisuallyHidden>
          </>
        )}
      </div>
    </OfflineStateContext>
  );
}

export interface OfflineStatePartProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

/** The heading element the caller passes, as the single child with `asChild`. */
export function OfflineStateTitle({ asChild = false, className, ...props }: OfflineStatePartProps) {
  const { size, tone } = useOfflineState('Title');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="offline-state-title"
      className={offlineStateStyles({ size, tone }).title({ className })}
      {...props}
    />
  );
}

/** What is unavailable and why; the app adds the last-online time and the queued changes here. */
export function OfflineStateDescription({ className, ...props }: ComponentPropsWithRef<'p'>) {
  const { size, tone } = useOfflineState('Description');

  return (
    <p
      data-slot="offline-state-description"
      className={offlineStateStyles({ size, tone }).description({ className })}
      {...props}
    />
  );
}

/** The list of what the cache holds; leave it out when nothing is available. */
export function OfflineStateAvailable({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'div'>) {
  const { size, tone } = useOfflineState('Available');
  const { availableOffline } = useUiCopy();
  const styles = offlineStateStyles({ size, tone });

  return (
    <div data-slot="offline-state-available" className={styles.available({ className })} {...props}>
      <p className={styles.availableHeading()}>{availableOffline}</p>
      <ul className={styles.list()}>{children}</ul>
    </div>
  );
}

export interface OfflineStateLinkProps extends ComponentPropsWithRef<'a'> {
  /** The finished count, "6 videos". */
  count?: string;
  /** Takes the router link and draws the row on it. */
  asChild?: boolean;
}

export function OfflineStateLink({
  count,
  asChild = false,
  className,
  children,
  ...props
}: OfflineStateLinkProps) {
  const { size, tone } = useOfflineState('Link');
  const styles = offlineStateStyles({ size, tone });
  const Element = asChild ? Slot.Root : 'a';

  return (
    <li data-slot="offline-state-link">
      <Element className={styles.link({ className })} {...props}>
        <Slot.Slottable>{children}</Slot.Slottable>
        {count !== undefined && (
          <>
            {' '}
            <span className={styles.count()}>{count}</span>
          </>
        )}
      </Element>
    </li>
  );
}

/** The primary offline action beside the retry: a button, or with `asChild` the link that acts as one. */
export function OfflineStateAction({ className, ...props }: ButtonProps) {
  const { size, tone } = useOfflineState('Action');

  return (
    <Button
      data-slot="offline-state-action"
      className={offlineStateStyles({ size, tone }).action({ className })}
      {...props}
    />
  );
}

export interface OfflineStateReconnectedProps extends ComponentPropsWithRef<'p'> {
  /** Called four seconds after it appears, so the app removes it. */
  onDismiss?: () => void;
}

/** The "Back online" line under `tone="success"`, which dismisses itself. */
export function OfflineStateReconnected({
  onDismiss,
  className,
  ...props
}: OfflineStateReconnectedProps) {
  const { size, tone } = useOfflineState('Reconnected');
  const { backOnline } = useUiCopy();
  const dismiss = useEffectEvent(() => onDismiss?.());

  useEffect(() => {
    const timer = setTimeout(dismiss, RECONNECTED_MS);
    const stopTimer = () => clearTimeout(timer);
    return stopTimer;
  }, []);

  return (
    <p
      data-slot="offline-state-reconnected"
      role={size === 'banner' ? undefined : 'status'}
      className={offlineStateStyles({ size, tone }).title({ className })}
      {...props}
    >
      {backOnline}
    </p>
  );
}
