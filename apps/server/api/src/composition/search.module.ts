import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { Singleflight } from '@vp/concurrency';
import { SearchService } from '../services/index';
import { Services } from './service-tokens';

export function registerSearchServices(c: Container): Container {
  return c.provide(
    Services.SearchService,
    (c) =>
      new SearchService({
        search: c.get(Adapters.Repositories).search,
        suggestions: c.get(Adapters.SearchSuggestions),
        cache: c.get(Adapters.Cache),
        singleflight: new Singleflight(),
        paginator: c.get(Services.Paginator),
        cdn: c.get(Adapters.Config).cdn,
        now: Date.now,
      })
  );
}
