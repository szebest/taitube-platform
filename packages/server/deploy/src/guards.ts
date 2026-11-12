import type { Environment } from './environment-spec';

/** @internal The context an environment deploys to: a cluster context, or the Docker context a compose project runs on. */
export function declaredContext(env: Environment): string {
  return env.kind === 'compose' ? env.compose.context : env.cluster.context;
}

export function contextFinding(env: Environment, current: string | undefined): string | undefined {
  const declared = declaredContext(env);
  if (current === undefined || current === '') {
    return `no current context: ${env.name} deploys to ${declared}`;
  }
  return current === declared
    ? undefined
    : `refusing ${env.name}: the current context is ${current}, the environment declares ${declared}`;
}

export interface Confirmation {
  yes: boolean;
  typed: string | undefined;
}

/** A protected environment needs `--yes`; one that asks for its name typed back accepts nothing less. */
export function confirmationFinding(
  env: Environment,
  confirmation: Confirmation
): string | undefined {
  if (!env.protected || confirmation.typed === env.name) return undefined;
  if (env.typedConfirmation === true) {
    return `${env.name} is protected: type its name back with --confirm ${env.name} (CONFIRM=${env.name}), --yes is not enough`;
  }
  return confirmation.yes
    ? undefined
    : `${env.name} is protected: pass --yes, or --confirm ${env.name}`;
}

/** A protected environment runs a release, never whatever `latest` points at when the pods next pull. */
export function tagFinding(env: Environment, tag: string | undefined): string | undefined {
  if (!env.protected || env.images.source !== 'registry') return undefined;
  return tag === undefined || tag === 'latest'
    ? `${env.name} is protected: pin an image tag, e.g. TAG=v1.2.3, not ${tag ?? 'none'}`
    : undefined;
}
