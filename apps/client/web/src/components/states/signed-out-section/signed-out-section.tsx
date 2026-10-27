import { EmptyState, type EmptyStatePartProps, SignedOutIllustration } from '@vp/components';
import type { ButtonProps } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

/** What a guest sees in place of a members-only section of a public page: one editorial line and a way to sign in. */
export function SignedOutSectionRoot({ children, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <EmptyState.Root size="section" titleStyle="editorial" {...props}>
      <EmptyState.Illustration>
        <SignedOutIllustration />
      </EmptyState.Illustration>
      {children}
    </EmptyState.Root>
  );
}

export function SignedOutSectionLine(props: EmptyStatePartProps) {
  return <EmptyState.Title {...props} />;
}

export function SignedOutSectionAction(props: ButtonProps) {
  return <EmptyState.Action {...props} />;
}
