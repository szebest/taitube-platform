import type { CommentActionBody } from '@vp/api-contracts';
import { DEFAULT_DISCLOSURE } from '@vp/domain';
import { actionOf } from '../moderation-action';

describe('apps/server/api/services: moderation action', () => {
  it.each([
    { name: 'an approval', body: { action: 'approve' }, action: { action: 'approve' } },
    { name: 'an unhide', body: { action: 'unhide' }, action: { action: 'unhide' } },
    {
      name: 'a hold, by the channel default',
      body: { action: 'hold' },
      action: { action: 'hold', disclosure: DEFAULT_DISCLOSURE.manual_hold },
    },
    {
      name: 'a hide, by the channel default',
      body: { action: 'hide' },
      action: { action: 'hide', disclosure: DEFAULT_DISCLOSURE.hide },
    },
    {
      name: 'a removal, by the channel default',
      body: { action: 'remove' },
      action: { action: 'remove', disclosure: DEFAULT_DISCLOSURE.remove },
    },
    {
      name: 'a removal with the moderator disclosure',
      body: { action: 'remove', disclosure: 'silent', reason: 'spam' },
      action: { action: 'remove', disclosure: 'silent', reason: 'spam' },
    },
  ] satisfies { name: string; body: CommentActionBody; action: object }[])(
    'reads $name',
    ({ body, action }) => {
      expect(actionOf(body, DEFAULT_DISCLOSURE)).toEqual(action);
    }
  );
});
