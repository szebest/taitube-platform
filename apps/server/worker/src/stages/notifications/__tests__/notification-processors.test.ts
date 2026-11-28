import {
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryWebhookDispatcher,
} from '@vp/adapters/in-memory';
import { notificationProcessors } from '../notification-processors';
import { logger } from './notification-harness';

describe('apps/server/worker/stages: notification-processors', () => {
  const processors = notificationProcessors({
    repositories: new InMemoryRepositories(),
    logger,
    getQueue: () => new InMemoryJobQueue('notify'),
    now: () => 0,
    webhookDispatcher: new InMemoryWebhookDispatcher(),
  });

  it('has a processor for each job that creates or announces notifications', () => {
    expect(Object.keys(processors).sort()).toEqual([
      'announce-comment-held',
      'announce-live',
      'notify-comment',
      'notify-heart',
      'notify-moderation',
      'notify-party-invite',
      'notify-party-reminder',
      'notify-post-subscribers',
      'notify-processing',
      'notify-subscribers',
      'notify-team-invite',
    ]);
  });

  it.each(Object.keys(processors))(
    'refuses a %s job whose payload does not match its contract',
    async (name) => {
      const result = await processors[name]?.({ id: `${name}--1`, name, data: { nope: true } });

      expect(result?.ok).toBe(false);
    }
  );
});
