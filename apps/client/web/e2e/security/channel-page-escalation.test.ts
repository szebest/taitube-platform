import { expect, test } from '../../../../../tests/playwright/fixtures';
import { PAGE_TEAM_REFUSED } from './channel-page-attempts';

test.describe('a moderator is refused the channel page, with problem+json', () => {
  for (const { name, persona, ...request } of PAGE_TEAM_REFUSED) {
    test(`a moderator of the channel cannot ${name}`, async ({ api, stack }) => {
      const member = await api(persona, { channelId: stack.team.channelId });

      const response = await member.fetch(request.path, request);

      expect(response.status()).toBe(403);
      expect(response.headers()['content-type']).toContain('application/problem+json');
      expect(await response.json()).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });
  }
});
