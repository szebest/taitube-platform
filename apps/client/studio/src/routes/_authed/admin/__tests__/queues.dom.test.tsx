import { screen } from '@testing-library/react';

import { dlqEntry, renderQueues } from '#app/features/admin/components/__tests__/queues.fixture';

describe('apps/client/studio: /admin/queues', () => {
  it('shows the parked count, the Bull Board link and the dead-letter list together', async () => {
    const entry = dlqEntry();
    await renderQueues('/admin/queues', [entry]);

    expect(await screen.findByRole('link', { name: 'Open Bull Board' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Dead-letter queue' })).toBeInTheDocument();
    expect(await screen.findByText('Parked jobs')).toBeInTheDocument();
    expect(await screen.findByText(entry.jobId)).toBeInTheDocument();
  });

  it('reads a status the contract refuses as no filter', async () => {
    const entry = dlqEntry();
    await renderQueues('/admin/queues?status=LOST', [entry]);

    expect(await screen.findByText(entry.jobId)).toBeInTheDocument();
  });
});
