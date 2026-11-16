import type { AnyProvider } from '@kit/di';
import { type EnvRecord, environmentProviders } from './environment';

/** Node and Bun. The env record is the one the deployable's `main.ts` read; nothing here reads it. */
export function nodeRuntime({ env }: { env: EnvRecord }): AnyProvider[] {
  return environmentProviders(env);
}
