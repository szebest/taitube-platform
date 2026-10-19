import type { PreferencesView, UpdatePreferencesBody } from '@vp/api-contracts';
import type { UserPreferencesRepositoryPort } from '@vp/core/repositories';
import {
  type AuthorizationFailure,
  decidePreferencesAccess,
  decidePreferencesUpdate,
  preferencesConflict,
  type UpdatePreferencesFailure,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { err, isErr, map, ok, type Result } from '@vp/result';
import { toPreferencesView } from './preferences-views';

export interface PreferencesServiceDeps {
  preferences: UserPreferencesRepositoryPort;
}

type ReadPreferencesFailure = AuthorizationFailure | DatabaseUnavailable;
type SavePreferencesFailure = ReadPreferencesFailure | UpdatePreferencesFailure;

/** One preferences document per account, saved under optimistic locking on its `version`. */
export class PreferencesService {
  constructor(private readonly deps: PreferencesServiceDeps) {}

  async get(
    viewer: UserContext,
    ownerId: string
  ): Promise<Result<PreferencesView, ReadPreferencesFailure>> {
    const allowed = decidePreferencesAccess({ actor: viewer, ownerId, action: 'read' });
    if (isErr(allowed)) return allowed;

    return map(await this.deps.preferences.find(ownerId), toPreferencesView);
  }

  async update(
    editor: UserContext,
    ownerId: string,
    body: UpdatePreferencesBody
  ): Promise<Result<PreferencesView, SavePreferencesFailure>> {
    const allowed = decidePreferencesAccess({ actor: editor, ownerId, action: 'update' });
    if (isErr(allowed)) return allowed;

    const current = await this.deps.preferences.find(ownerId);
    if (isErr(current)) return current;
    const { version, ...patch } = body;
    const merged = decidePreferencesUpdate({
      userId: ownerId,
      current: current.value,
      version,
      patch,
    });
    if (isErr(merged)) return merged;

    const saved = await this.deps.preferences.save({
      userId: ownerId,
      preferences: merged.value,
      expectedVersion: version,
    });
    if (isErr(saved)) return saved;
    if (saved.value) return ok(toPreferencesView(saved.value));

    const raced = await this.deps.preferences.find(ownerId);
    return isErr(raced) ? raced : err(preferencesConflict(ownerId, raced.value));
  }
}
