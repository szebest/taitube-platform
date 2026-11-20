import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import type { ChannelRole } from '@vp/domain';
import { renderDevelopers } from '#app/features/developers/__tests__/render-developers';

const SECTIONS = ['Personal access tokens', 'Webhooks', 'Exports', 'API reference'];
const sections = () => SECTIONS.filter((name) => screen.queryByRole('region', { name }));

describe('apps/client/studio: DevelopersPage', () => {
  it('lays out tokens, webhooks, exports and the API reference for the owner, and passes axe', async () => {
    await renderDevelopers();

    expect(sections()).toEqual(SECTIONS);
    expect(await axeViolations()).toEqual([]);
  });

  it.each([
    {
      role: 'editor' as ChannelRole,
      shown: ['Personal access tokens', 'Webhooks', 'API reference'],
    },
    {
      role: 'moderator' as ChannelRole,
      shown: ['Personal access tokens', 'Webhooks', 'API reference'],
    },
    { role: 'analytics' as ChannelRole, shown: SECTIONS },
    { role: 'manager' as ChannelRole, shown: SECTIONS },
  ])('shows the exports to a $role only when the role may export', async ({ role, shown }) => {
    await renderDevelopers({ role });

    expect(sections()).toEqual(shown);
  });
});
