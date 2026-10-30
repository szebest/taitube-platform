import { Link, useRouter } from '@tanstack/react-router';
import { ErrorState, type ErrorStateKind } from '@vp/components';
import { type ErrorCode, ErrorCodes } from '@vp/errors';
import { useT } from '@vp/intl-react';
import type { MessageKey } from '@vp/messages';

import { failureCode } from './failure-code';
import { present } from './present-failure';

const TITLES = {
  'not-found': 'errorPage.notFoundTitle',
  forbidden: 'errorPage.forbiddenTitle',
  unauthorised: 'errorPage.unauthorisedTitle',
  'rate-limited': 'errorPage.rateLimitedTitle',
  server: 'errorPage.serverTitle',
  generic: 'errorPage.genericTitle',
} as const satisfies Record<ErrorStateKind, MessageKey>;

function FailurePage({ code }: { code: ErrorCode }) {
  const router = useRouter();
  const { tOr } = useT();
  const { kind, copy, retryable } = present({ code });

  return (
    <ErrorState.Root
      kind={kind}
      onRetry={
        retryable
          ? () => {
              void router.invalidate();
            }
          : undefined
      }
    >
      <ErrorState.Illustration />
      <ErrorState.Title asChild>
        <h1>{tOr(TITLES[kind], {}, '')}</h1>
      </ErrorState.Title>
      <ErrorState.Description>{tOr(copy, {}, '')}</ErrorState.Description>
      <ErrorState.Retry />
      <ErrorState.Action asChild>
        <Link to="/">{tOr('errorPage.home', {}, '')}</Link>
      </ErrorState.Action>
    </ErrorState.Root>
  );
}

/** A route whose loader or render threw: the page for the code the API answered with, a 500 for anything else. */
export function RouteError({ error }: { error: unknown }) {
  return <FailurePage code={failureCode(error)} />;
}

/** `notFound()` from a loader, or an address no route matches. */
export function RouteNotFound() {
  return <FailurePage code={ErrorCodes.ROUTE_NOT_FOUND} />;
}
