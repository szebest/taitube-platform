import type { ProviderSubject } from '@kit/di/contract';
import { err, tryCatch } from '@kit/result';
import type { Container } from '../container';

export function containerProviderSubject(container: Container): ProviderSubject {
  return {
    provide: (wanted, value) => containerProviderSubject(container.provide(wanted, () => value)),
    resolve: (wanted) => {
      const found = tryCatch(
        () => container.get(wanted),
        (cause) => cause
      );
      if (found.ok) return found;
      if (
        found.error instanceof Error &&
        found.error.message === `No provider for ${wanted.name}`
      ) {
        return err({ code: 'MISSING_PROVIDER', token: wanted.name });
      }
      throw found.error;
    },
  };
}
