import { screen, within } from '@testing-library/react';
import type { WebhookTestView } from '@vp/api-contracts';
import { webhook, WEBHOOK_ID } from '#app/features/developers/__tests__/developers-api.fixture';
import { renderDevelopers } from '#app/features/developers/__tests__/render-developers';

const URL = 'https://hooks.example.com/taitube';
const webhooks = () => screen.getByRole('region', { name: 'Webhooks' });

describe('apps/client/studio: WebhooksSection', () => {
  it('lists each webhook with the events it hears about', async () => {
    await renderDevelopers({ webhooks: [webhook({ events: ['export.ready', 'comment.held'] })] });

    const row = (await within(webhooks()).findByText(URL)).closest('tr') as HTMLElement;
    expect(within(row).getByText('Export ready')).toBeInTheDocument();
    expect(within(row).getByText('Comment held')).toBeInTheDocument();
  });

  it.each([
    {
      scenario: 'a delivery',
      testResult: { outcome: 'delivered' } as WebhookTestView,
      title: `Test delivered to ${URL}`,
      description: undefined,
    },
    {
      scenario: 'a receiver that answered with an error',
      testResult: { outcome: 'failed', reason: 'status', status: 410 } as WebhookTestView,
      title: `Test not delivered to ${URL}`,
      description: 'It answered 410.',
    },
    {
      scenario: 'a receiver that never answered',
      testResult: { outcome: 'failed', reason: 'timeout', status: null } as WebhookTestView,
      title: `Test not delivered to ${URL}`,
      description: 'It did not answer within five seconds.',
    },
  ])('sends a test and says what came of $scenario', async ({ testResult, title, description }) => {
    const { user, requests } = await renderDevelopers({ webhooks: [webhook()], testResult });

    await user.click(
      await within(webhooks()).findByRole('button', { name: `Send test to ${URL}` })
    );

    expect(await screen.findByText(title)).toBeInTheDocument();
    if (description) expect(screen.getByText(description)).toBeInTheDocument();
    expect(requests.tested).toEqual([WEBHOOK_ID]);
  });

  it('removes a webhook once the creator confirms', async () => {
    const { user, requests } = await renderDevelopers({ webhooks: [webhook()] });

    await user.click(await within(webhooks()).findByRole('button', { name: `Remove ${URL}` }));
    await user.click(
      within(await screen.findByRole('alertdialog', { name: 'Remove this webhook?' })).getByRole(
        'button',
        { name: 'Remove' }
      )
    );

    expect(await within(webhooks()).findByText('No webhooks yet')).toBeInTheDocument();
    expect(requests.removed).toEqual([WEBHOOK_ID]);
  });
});
