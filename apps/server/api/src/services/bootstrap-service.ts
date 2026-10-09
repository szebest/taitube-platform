import type { UserContext } from '@vp/permissions';
import { isErr, map, ok } from '@vp/result';
import type { CategoryService } from './category-service';
import type { ChannelService } from './channel-service';

export interface BootstrapServiceDeps {
  channelService: ChannelService;
  categoryService: CategoryService;
  featureFlags: readonly string[];
}

/** What a client needs before its first render, gathered in one call. */
export class BootstrapService {
  private readonly featureFlags: Record<string, boolean>;

  constructor(private readonly deps: BootstrapServiceDeps) {
    this.featureFlags = Object.fromEntries(deps.featureFlags.map((flag) => [flag, true]));
  }

  async contextFor(caller: UserContext | null) {
    const [user, categories] = await Promise.all([
      this.channelOf(caller),
      this.deps.categoryService.listActive(),
    ]);
    if (isErr(user)) return user;
    if (isErr(categories)) return categories;

    return ok({
      user: user.value,
      categories: categories.value.categories,
      featureFlags: this.featureFlags,
    });
  }

  private async channelOf(caller: UserContext | null) {
    if (!caller) return ok(null);

    return map(await this.deps.channelService.getAccount(caller.id), (account) => account.channel);
  }
}
