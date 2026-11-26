import { createRegistry, provide, type Registry } from '@kit/di';
import { ErrorCodeRegistry } from '@kit/errors';
import { nodeRuntime } from '@kit/runtime/node';
import { ShopErrorCodes } from './errors';

export function createShopRegistry(env: Record<string, string | undefined>): Registry {
  return createRegistry().provide(provide(ErrorCodeRegistry, ShopErrorCodes), ...nodeRuntime({ env }));
}
