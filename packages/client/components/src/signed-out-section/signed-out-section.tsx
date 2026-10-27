import type { ComponentPropsWithRef } from 'react';
import { SignedOutIllustration } from '../illustrations';
import { EmptyState } from '../states/empty-state';

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
