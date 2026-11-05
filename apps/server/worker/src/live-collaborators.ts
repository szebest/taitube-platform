import type { StorageClient } from '@vp/core/ports';
import type { AppConfig } from '@vp/env-schema';
import type { LiveStageDeps } from './stages/live/live-stage';
import { LiveUploader } from './stages/live/live-uploader';

interface CollaboratorDeps {
  config: AppConfig;
  storage: StorageClient;
}

/** What a live run builds per broadcast, and the clock it polls the gateway on. */
export function liveCollaborators(
  d: CollaboratorDeps
): Pick<LiveStageDeps, 'newUploader' | 'wait'> {
  return {
    newUploader: () => new LiveUploader(d.storage, d.config.buckets.public),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
