import { fromPromise } from '@vp/result';
import { type ComponentType, createElement, lazy, type ReactNode, Suspense } from 'react';
import { isModuleImportFailure, watchPreloadErrors } from './module-import-failure';
import { reloadOnceForStaleDeploy } from './stale-deploy';

type Loaded<TProps extends object> = { default: ComponentType<TProps> };

export type LazyComponent<TProps extends object> = ComponentType<TProps> & {
  /** Starts the import ahead of the first render; the same promise every render and retry shares. */
  preload: () => Promise<void>;
};

export type LazyComponentOptions = {
  /** Names the component in React's tree and in diagnostics. */
  name: string;
  /** Shown while the module loads; `false` renders no boundary, so the caller's own decides. */
  fallback?: ReactNode | false;
  retry?: { attempts: number; baseDelayMs: number };
};

const DEFAULT_RETRY = { attempts: 3, baseDelayMs: 500 };

function wait(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

async function importWithRetry<TModule>(
  load: () => Promise<TModule>,
  { attempts, baseDelayMs }: { attempts: number; baseDelayMs: number }
): Promise<TModule> {
  for (let attempt = 0; ; attempt += 1) {
    const result = await fromPromise(load, (cause) => cause);
    if (result.ok) {
      return result.value;
    }
    if (!isModuleImportFailure(result.error) || attempt >= attempts) {
      throw result.error;
    }
    await wait(baseDelayMs * 2 ** attempt);
  }
}

/**
 * A component whose module loads on first use, or on `preload()`. One import promise serves every
 * render, preload and retry, and is dropped when it fails; once the module is in, the component renders
 * directly, with no boundary to flash on a remount. Only import failures are retried, and one that
 * outlives the retries is a stale deploy, which reloads the page once. Not for routes: the router splits those.
 */
export function lazyComponent<TProps extends object>(
  load: () => Promise<Loaded<TProps>>,
  { name, fallback = null, retry = DEFAULT_RETRY }: LazyComponentOptions
): LazyComponent<TProps> {
  let loading: Promise<ComponentType<TProps>> | undefined;
  let loaded: ComponentType<TProps> | undefined;

  const settle = async (): Promise<ComponentType<TProps>> => {
    const result = await fromPromise(
      () => importWithRetry(load, retry),
      (cause) => cause
    );
    if (result.ok) {
      loaded = result.value.default;
      return loaded;
    }
    loading = undefined;
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

  const Deferred = lazy(() => start().then((component) => ({ default: component })));

  function LazyBoundary(props: TProps) {
    if (loaded) {
      return createElement(loaded, props);
    }
    const content = createElement(Deferred, props as React.ComponentProps<typeof Deferred>);
    return fallback === false ? content : <Suspense fallback={fallback}>{content}</Suspense>;
  }

  return Object.assign(LazyBoundary, {
    displayName: `Lazy(${name})`,
    preload: async () => {
      await start();
    },
  });
}
