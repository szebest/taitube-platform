import { describeCookieJarContract } from '../contract';
import { CookieJar } from '../tokens';
import { providedBy, resolveFrom } from './providers';

describe('@kit/runtime/browser: CookieJar', () => {
  describeCookieJarContract((held) => resolveFrom(providedBy.browser({}, held), CookieJar));
});
