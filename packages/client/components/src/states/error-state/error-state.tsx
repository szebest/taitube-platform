import { Button, type ButtonProps, Slot, useUiCopy, VisuallyHidden } from '@vp/ui';
import {
  type ComponentPropsWithRef,
  type ComponentType,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ErrorIllustration,
  NotFoundIllustration,
  SignedOutIllustration,
} from '../../illustrations';
import { ErrorStateContext, useErrorState } from './error-state.context';
import { errorStateStyles } from './error-state.variants';
import type { ErrorStateKind } from './types';

const KIND_ILLUSTRATIONS = {
  generic: ErrorIllustration,
  server: ErrorIllustration,
  'rate-limited': ErrorIllustration,
  'not-found': NotFoundIllustration,
  forbidden: SignedOutIllustration,
  unauthorised: SignedOutIllustration,
} satisfies Record<ErrorStateKind, ComponentType>;

export interface ErrorStateRootProps extends ComponentPropsWithRef<'div'> {
  kind: ErrorStateKind;
  /** Shows the retry button; a kind that cannot be retried leaves it out. */
  onRetry?: () => void;
  /** The retry is running: its button shows a spinner and ignores clicks. */
  retrying?: boolean;
}

/** A whole page or route that failed: what went wrong and a way on. */
export function ErrorStateRoot({
  kind,
  onRetry,
  retrying = false,
  className,
  ...props
}: ErrorStateRootProps) {
  const shared = useMemo(() => ({ kind, onRetry, retrying }), [kind, onRetry, retrying]);

  return (
    <ErrorStateContext value={shared}>
      <div data-slot="error-state" className={errorStateStyles().root({ className })} {...props} />
    </ErrorStateContext>
  );
}

/** The drawing for the kind, unless the caller passes its own. */
export function ErrorStateIllustration({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'div'>) {
  const { kind } = useErrorState('Illustration');
  const Drawing = KIND_ILLUSTRATIONS[kind];

  return (
    <div
      data-slot="error-state-illustration"
      aria-hidden="true"
      className={errorStateStyles().illustration({ className })}
      {...props}
    >
      {children ?? <Drawing />}
    </div>
  );
}

export interface ErrorStatePartProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

/** The heading element the caller passes: the page's `h1`, or an `h2` for a part of a page. */
export function ErrorStateTitle({ asChild = false, className, ...props }: ErrorStatePartProps) {
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="error-state-title"
      className={errorStateStyles().title({ className })}
      {...props}
    />
  );
}

export function ErrorStateDescription({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="error-state-description"
      className={errorStateStyles().description({ className })}
      {...props}
    />
  );
}

/** The way on: a link to somewhere safe, with `asChild`, or a button. */
export function ErrorStateAction(props: ButtonProps) {
  return <Button data-slot="error-state-action" variant="outline" {...props} />;
}

/** The root's `onRetry` as a button; nothing when the root has none. */
export function ErrorStateRetry(props: Omit<ButtonProps, 'asChild' | 'onClick'>) {
  const { onRetry, retrying } = useErrorState('Retry');
  const { retry } = useUiCopy();

  if (onRetry === undefined) {
    return null;
  }

  return (
    <Button data-slot="error-state-retry" loading={retrying} onClick={onRetry} {...props}>
      {retry}
    </Button>
  );
}

const COPIED_FEEDBACK_MS = 2000;

export interface ErrorStateReferenceProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  /** The trace or request id the viewer can pass to support. */
  value: string;
}

/** The id in mono type, with a button that copies it and says so for two seconds. */
export function ErrorStateReference({ value, className, ...props }: ErrorStateReferenceProps) {
  const { reference, copy, copied: copiedWord } = useUiCopy();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);

    return () => clearTimeout(timer);
  }, [copied]);

  const copyValue = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  };

  return (
    <div
      data-slot="error-state-reference"
      className={errorStateStyles().reference({ className })}
      {...props}
    >
      <span>
        {reference} <span className={errorStateStyles().referenceValue()}>{value}</span>
      </span>
      <Button variant="ghost" size="sm" onClick={copyValue}>
        {copied ? copiedWord : copy}
      </Button>
      <VisuallyHidden role="status">{copied ? copiedWord : ''}</VisuallyHidden>
    </div>
  );
}

/** The technical text behind a disclosure, in mono type; the app passes it in development builds only. */
export function ErrorStateDetails({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'details'>) {
  const { technicalDetails } = useUiCopy();
  const styles = errorStateStyles();

  return (
    <details data-slot="error-state-details" className={styles.details({ className })} {...props}>
      <summary className={styles.detailsSummary()}>{technicalDetails}</summary>
      <pre className={styles.detailsBody()}>{children}</pre>
    </details>
  );
}
