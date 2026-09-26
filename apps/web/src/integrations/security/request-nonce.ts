import { getGlobalStartContext } from '@tanstack/react-start';
import { tryCatch, unwrapOr } from '@vp/result';

export function requestNonce(): string | undefined {
  const context = unwrapOr(
    tryCatch(
      () => getGlobalStartContext(),
      (cause) => cause
    ),
    undefined
  );
  return context?.nonce;
}
