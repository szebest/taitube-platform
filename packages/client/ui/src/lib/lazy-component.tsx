import { fromPromise } from '@vp/result';
import {
  type ComponentProps,
  type ComponentType,
  createElement,
  lazy,
  type ReactNode,
  Suspense,
} from 'react';
import { isModuleImportFailure, watchPreloadErrors } from './module-import-failure';
import { moduleUrlOf, retryUrl } from './module-import-url';
import { reloadOnceForStaleDeploy } from './stale-deploy';

export type LazyComponent<TProps extends object> = ComponentType<TProps> & {
  /** Starts the import ahead of the first render; the same promise every render and retry shares. */
  preload: () => Promise<void>;
};

export type LazyComponentOptions<TModule, TProps extends object> = {
  /** Names the component in React's tree and in diagnostics. */
  name: string;
  /** The component inside the loaded module, so a retry can read it from the same module under another URL. */
  pick: (module: TModule) => ComponentType<TProps>;
  /** Shown while the module loads; `false` renders no boundary, so the caller's own decides. */
  fallback?: ReactNode | false;
  retry?: { attempts: number; baseDelayMs: number };
  importUrl?: (url: string) => Promise<TModule>;
};

const DEFAULT_RETRY = { attempts: 3, baseDelayMs: 500 };

function wait(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/**
 * Imports once; on a module import failure that names its URL, again from that URL with a retry
 * parameter, since a browser remembers a failed fetch of the original. With no URL to retry, the
 * failure goes straight to the caller.
 */
async function importWithRetry<TModule>(
  load: () => Promise<TModule>,
  importUrl: (url: string) => Promise<TModule>,
  { attempts, baseDelayMs }: { attempts: number; baseDelayMs: number }
): Promise<TModule> {
  const first = await fromPromise(load, (cause) => cause);
  if (first.ok) {
    return first.value;
  }
  const url = isModuleImportFailure(first.error) ? moduleUrlOf(first.error) : undefined;
  if (url === undefined) {
    throw first.error;
  }
  let lastError = first.error;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await wait(baseDelayMs * 2 ** (attempt - 1));
    const retried = await fromPromise(
      () => importUrl(retryUrl(url, attempt)),
      (cause) => cause
    );
    if (retried.ok) {
      return retried.value;
    }
    lastError = retried.error;
    if (!isModuleImportFailure(lastError)) {
      break;
    }
  }
  throw lastError;
}

/**
 * A component whose module loads on first use, or on `preload()`. One import promise serves every
 * render and preload, and is dropped when it fails, so the next render asks again; once the module is
 * in, the component renders directly. Only import failures are retried, from a cache-busted URL, and one
 * that outlives the retries is a stale deploy, which reloads the page once. The boundary is always
 * there unless `fallback` is `false`, so the server and a fresh client render the same tree. Not for routes.
 */
export function lazyComponent<TModule, TProps extends object>(
  load: () => Promise<TModule>,
  {
    name,
    pick,
    fallback = null,
    retry = DEFAULT_RETRY,
    importUrl = (url) => import(/* @vite-ignore */ url) as Promise<TModule>,
  }: LazyComponentOptions<TModule, TProps>
): LazyComponent<TProps> {
  let loading: Promise<ComponentType<TProps>> | undefined;
  let loaded: ComponentType<TProps> | undefined;

  const settle = async (): Promise<ComponentType<TProps>> => {
    const result = await fromPromise(
      () => importWithRetry(load, importUrl, retry),
      (cause) => cause
    );
    if (result.ok) {
      loaded = pick(result.value);
      return loaded;
    }
    loading = undefined;
    Deferred = deferredFor();
    if (reloadOnceForStaleDeploy(result.error)) {
      return new Promise<never>(() => undefined);
    }
    throw result.error;
  };

  const start = (): Promise<ComponentType<TProps>> => {
    watchPreloadErrors();
    loading ??= settle();
    return loading;
  };

  const deferredFor = () => lazy(() => start().then((component) => ({ default: component })));
  let Deferred = deferredFor();

  function LazyBoundary(props: TProps) {
    const content = loaded
      ? createElement(loaded, props)
      : createElement(Deferred, props as ComponentProps<typeof Deferred>);
    return fallback === false ? content : <Suspense fallback={fallback}>{content}</Suspense>;
  }

  return Object.assign(LazyBoundary, {
    displayName: `Lazy(${name})`,
    preload: async () => {
      await start();
    },
  });
}
