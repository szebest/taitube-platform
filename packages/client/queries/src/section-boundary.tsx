import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { CatchBoundary } from '@tanstack/react-router';
import { SectionError, type SectionErrorRootProps } from '@vp/components';
import { useT } from '@vp/intl-react';
import type { ReactNode } from 'react';

import { failureCode } from './failure-code';
import { present } from './present-failure';

export interface SectionBoundaryProps extends Pick<SectionErrorRootProps, 'layout' | 'className'> {
  /** What failed, in the viewer's language. */
  message: string;
  /** A new key clears a failure, as a different video or comment does. */
  resetKey: string;
  /** The viewer's own action loaded this section, so the retry takes focus. */
  viewerTriggered?: boolean;
  children: ReactNode;
}

/**
 * Keeps a failing query to its own section: `message` and the presented copy for the failure, with a
 * retry in the section's place. `className` gives it the height of the section's skeleton.
 */
export function SectionBoundary({
  message,
  resetKey,
  viewerTriggered = false,
  layout,
  className,
  children,
}: SectionBoundaryProps) {
  const { tOr } = useT();

  return (
    <QueryErrorResetBoundary>
      {({ reset: resetQueries }) => (
        <CatchBoundary
          getResetKey={() => resetKey}
          errorComponent={({ error, reset: resetBoundary }) => (
              <SectionError.Root
                role="alert"
                layout={layout}
                className={className}
                autoFocusRetry={viewerTriggered}
                onRetry={() => {
                  resetQueries();
                  resetBoundary();
                }}
              >
                <SectionError.Message>{message}</SectionError.Message>
                <SectionError.Support>
                  {tOr(present({ code: failureCode(error) }).copy, {}, '')}
                </SectionError.Support>
              </SectionError.Root>
          )}
        >
          {children}
        </CatchBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
