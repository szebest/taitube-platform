import { Callout, Card } from '@vp/ui';
import { type ComponentPropsWithRef, useEffect, useId, useMemo, useRef } from 'react';
import { EmptyState } from '../states/empty-state';
import { LoginCardContext, useLoginCard } from './login-card.context';
import { loginCardStyles } from './login-card.variants';

/** `/login` in either app: a title, the line saying why the viewer is here, a failure, and the ways to sign in. */
export function LoginCardRoot({ className, ...props }: ComponentPropsWithRef<'section'>) {
  const titleId = useId();
  const shared = useMemo(() => ({ titleId }), [titleId]);
  return (
    <LoginCardContext value={shared}>
      <Card.Root asChild className={loginCardStyles().root({ className })}>
        <section data-slot="login-card" aria-labelledby={titleId} {...props} />
      </Card.Root>
    </LoginCardContext>
  );
}

export function LoginCardTitle({ className, ...props }: ComponentPropsWithRef<'h1'>) {
  const { titleId } = useLoginCard('Title');

  return (
    <h1
      id={titleId}
      data-slot="login-card-title"
      className={loginCardStyles().title({ className })}
      {...props}
    />
  );
}

/** Why the viewer is back here, such as a session that ended: said once, above the form. */
export function LoginCardExpired({ className, children, ...props }: ComponentPropsWithRef<'div'>) {
  useLoginCard('Expired');

  return (
    <EmptyState.Root
      size="inline"
      role="status"
      data-slot="login-card-expired"
      className={className}
      {...props}
    >
      <EmptyState.Description>{children}</EmptyState.Description>
    </EmptyState.Root>
  );
}

/** A sign-in that failed, in the words the caller presents; focus moves here as it appears. */
export function LoginCardError({ className, children, ...props }: ComponentPropsWithRef<'div'>) {
  useLoginCard('Error');
  const callout = useRef<HTMLDivElement>(null);

  useEffect(() => {
    callout.current?.focus();
  }, []);

  return (
    <Callout.Root
      ref={callout}
      tabIndex={-1}
      tone="danger"
      role="alert"
      data-slot="login-card-error"
      className={className}
      {...props}
    >
      <Callout.Icon />
      <Callout.Body>{children}</Callout.Body>
    </Callout.Root>
  );
}

export function LoginCardBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  useLoginCard('Body');

  return (
    <div data-slot="login-card-body" className={loginCardStyles().body({ className })} {...props} />
  );
}
