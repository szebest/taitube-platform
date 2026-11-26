import { isErr } from '@kit/result';
import type { Result } from '@kit/result';
import type { VideoRepository } from '@vp/core/repositories';
import { BULK_EDIT_MAX_CONCURRENCY, type BulkEditPatch, mergeTags } from '@vp/domain';
import { type InvalidBulkEdit, publicReadFailure, validateBulkEdit } from '@vp/domain-rules';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { boundedMap } from './bounded-map';
import type { CreatorStudioService } from './creator-studio-service';
import type { CreatorVideoEdit, UpdateVideoServiceFailure } from './video-edit';

export interface VideoBulkEditDeps {
  videos: VideoRepository;
  studio: Pick<CreatorStudioService, 'update'>;
}

export interface BulkEditItem {
  id: string;
  ok: boolean;
  code?: string;
}

function codeOf(failure: UpdateVideoServiceFailure): string {
  return failure.code === ErrorCodes.FORBIDDEN ? publicReadFailure(failure).code : failure.code;
}

function editOf(
  patch: BulkEditPatch,
  current: { tags?: string[]; version: number }
): CreatorVideoEdit {
  const { addTags, removeTags, ...fields } = patch;
  const retag = addTags !== undefined || removeTags !== undefined;
  return {
    ...fields,
    ...(retag && { tags: mergeTags(current.tags ?? [], addTags, removeTags) }),
    version: current.version,
  };
}

/**
 * Every id is its own single edit: its own rule, its own read of the current version and its own
 * compare-and-set, so one refusal or one conflict fails that item and nothing else.
 */
export class VideoBulkEditService {
  constructor(private readonly deps: VideoBulkEditDeps) {}

  async edit(
    user: UserContext,
    input: { ids: readonly string[]; patch: BulkEditPatch }
  ): Promise<Result<{ items: BulkEditItem[] }, InvalidBulkEdit>> {
    const valid = validateBulkEdit(input);
    if (isErr(valid)) return valid;
    const { ids, patch } = valid.value;

    const items = await boundedMap(ids, BULK_EDIT_MAX_CONCURRENCY, (id) =>
      this.editOne(user, id, patch)
    );
    return { ok: true, value: { items } };
  }

  private async editOne(
    user: UserContext,
    id: string,
    patch: BulkEditPatch
  ): Promise<BulkEditItem> {
    const found = await this.deps.videos.findById(id);
    if (isErr(found)) return { id, ok: false, code: found.error.code };
    if (!found.value) return { id, ok: false, code: ErrorCodes.VIDEO_NOT_FOUND };

    const updated = await this.deps.studio.update(user, id, editOf(patch, found.value));
    return isErr(updated) ? { id, ok: false, code: codeOf(updated.error) } : { id, ok: true };
  }
}
