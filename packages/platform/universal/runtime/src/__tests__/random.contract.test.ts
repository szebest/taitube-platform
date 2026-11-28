import { describeRandomContract } from '../contract';
import { Random } from '../tokens';
import { providedBy, resolveFrom } from './providers';

describe('@kit/runtime/node: Random', () => {
  describeRandomContract(() => resolveFrom(providedBy.node(), Random));
});

describe('@kit/runtime/browser: Random', () => {
  describeRandomContract(() => resolveFrom(providedBy.browser(), Random));
});
