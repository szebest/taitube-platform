import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { CatchBoundary } from '@tanstack/react-router';
import { SectionError } from '@vp/components';
import type { ReactNode } from 'react';

export interface SectionBoundaryProps {
  /** What the failure says, in the viewer's language. */
  message: string;
  /** A new key clears a failure, as a different video or comment does. */
  resetKey: string;
  children: ReactNode;
}

/** Keeps a failing query to its own section, which offers a retry in the section's place. */
export function SectionBoundary({ message, resetKey, children }: SectionBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset: resetQueries }) => (
        <CatchBoundary
          getResetKey={() => resetKey}
          errorComponent={({ reset: resetBoundary }) => (
            <SectionError.Root
              role="alert"
              onRetry={() => {
                resetQueries();
                resetBoundary();
              }}
            >
              <SectionError.Message>{message}</SectionError.Message>
            </SectionError.Root>
          )}
        >
          {children}
        </CatchBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
