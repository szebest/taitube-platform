import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { NotificationService } from '../services/index';
import { Services } from './service-tokens';

export function registerNotificationServices(c: Container): Container {
  return c.provide(
    Services.NotificationService,
    (c) =>
      new NotificationService({
        notifications: c.get(Adapters.Repositories).notifications,
        paginator: c.get(Services.Paginator),
      })
  );
}
