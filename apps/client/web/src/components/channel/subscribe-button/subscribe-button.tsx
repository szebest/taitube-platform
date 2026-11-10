import { Button, type ButtonProps, Icon, VisuallyHidden } from '@vp/ui';

export type SubscribeButtonProps = Omit<
  ButtonProps,
  'variant' | 'tone' | 'shape' | 'asChild' | 'loading' | 'onToggle'
> & {
  subscribed: boolean;
  /** Holds the optimistic result with a spinner in the button. */
  pending?: boolean;
  onToggle: () => void;
};

/** The one Subscribe: the accent pill to subscribe, a quiet pill with a check once subscribed; its label is the caller's. */
export function SubscribeButton({
  subscribed,
  pending = false,
  onToggle,
  children,
  ...props
}: SubscribeButtonProps) {
  return (
    <>
      <Button
        data-slot="subscribe-button"
        variant={subscribed ? 'soft' : 'solid'}
        tone={subscribed ? 'neutral' : 'accent'}
        shape="pill"
        aria-pressed={subscribed}
        loading={pending}
        onClick={onToggle}
        {...props}
      >
        {subscribed && <Icon name="check" />}
        {children}
      </Button>
      <VisuallyHidden aria-live="polite">{subscribed ? children : null}</VisuallyHidden>
    </>
  );
}
