import { screen } from '@testing-library/react';
import { AdminPageSkeleton } from '#app/features/admin';
import { dlqEntry, renderQueues } from '#app/features/admin/__tests__/queues.fixture';
import { Route } from '../queues';

describe('apps/client/studio: /admin/queues', () => {
  it('shows its skeleton while the loader runs', () => {
    expect(Route.options.pendingComponent).toBe(AdminPageSkeleton);
  });

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
