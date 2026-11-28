import { describeEnvSourceContract } from '../contract';
import { EnvSource } from '../tokens';
import { providedBy, resolveFrom } from './providers';

describe('@kit/runtime/node: EnvSource', () => {
  describeEnvSourceContract((held) => resolveFrom(providedBy.node(held), EnvSource));
});

describe('@kit/runtime/browser: EnvSource', () => {
  describeEnvSourceContract((held) => resolveFrom(providedBy.browser(held), EnvSource));
});
