import { describeClockContract } from '../contract';
import { Clock } from '../tokens';
import { providedBy, resolveFrom } from './providers';

describe('@kit/runtime/node: Clock', () => {
  describeClockContract(() => resolveFrom(providedBy.node(), Clock));
});

describe('@kit/runtime/browser: Clock', () => {
  describeClockContract(() => resolveFrom(providedBy.browser(), Clock));
});
