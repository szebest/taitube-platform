import { getGlobalStartContext } from '@tanstack/react-start';
import { tryCatch, unwrapOr } from '@vp/result';

// Start types the request context from the app's registered middleware, which a package never sees.
type NonceContext = { nonce?: string };

export function requestNonce(): string | undefined {
  const context = unwrapOr(
    tryCatch(
      (): NonceContext | undefined => getGlobalStartContext(),
      (cause) => cause
    ),
    undefined
  );
  return context?.nonce;
}
