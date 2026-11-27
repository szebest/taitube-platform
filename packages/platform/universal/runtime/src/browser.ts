import { type AnyProvider, provide } from '@kit/di';
import { type EnvRecord, environmentProviders } from './environment';
import { CookieJar } from './tokens';

export interface BrowserRuntimeOptions {
  env: EnvRecord;
  cookies: Pick<CookieStore, 'get'>;
}

export function browserRuntime({ env, cookies }: BrowserRuntimeOptions): AnyProvider[] {
  return [
    ...environmentProviders(env),
    provide(CookieJar, { get: async (name) => (await cookies.get(name))?.value }),
  ];
}
