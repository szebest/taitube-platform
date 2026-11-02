import { adminUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { defineWebhookRules } from '../webhook.rules';
import { buildAbility } from './build-ability';

describe('rules/webhook.rules: who may register a webhook', () => {
  it.each<{ scenario: string; user: UserContext | null; expected: boolean }>([
    { scenario: 'nobody signed in', user: null, expected: false },
    { scenario: 'a guest', user: guestUser, expected: false },
    { scenario: 'a viewer', user: standardUser, expected: true },
    { scenario: 'an admin', user: adminUser, expected: true },
  ])('answers $expected for $scenario', ({ user, expected }) => {
    expect(buildAbility(defineWebhookRules, user).can('create', 'Webhook')).toBe(expected);
  });
});
