import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { WatchPartyViewer } from '@vp/permissions';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { PartyQueue } from '..';

const DJ: WatchPartyViewer = {
  permissions: ['queue.add', 'queue.remove'],
  topPosition: 20,
  isOwner: false,
  kind: 'user',
};

const LISTENER: WatchPartyViewer = { ...DJ, permissions: ['chat.post'] };

function renderQueue(viewer: WatchPartyViewer, { onAdd = vi.fn(), onRemove = vi.fn() } = {}) {
  render(
    <AppProviders>
      <PartyPermissionsProvider userContext={null} viewer={viewer}>
        <PartyQueue.Root>
          <PartyQueue.List>
            <PartyQueue.Item title="Big Buck Bunny" addedBy="Ana" current onRemove={onRemove} />
            <PartyQueue.Item title="Sintel" addedBy="Bruno" onRemove={onRemove} />
          </PartyQueue.List>
          <PartyQueue.Add onAdd={onAdd} />
        </PartyQueue.Root>
      </PartyPermissionsProvider>
    </AppProviders>
  );
}

describe('apps/client/web: PartyQueue', () => {
  it('marks the playing item and credits who added the others', () => {
    renderQueue(DJ);

    expect(screen.getByText('Now playing')).toBeInTheDocument();
    expect(screen.getByText('Added by Bruno')).toBeInTheDocument();
  });

  it('adds and removes for a viewer who holds the permissions', async () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    renderQueue(DJ, { onAdd, onRemove });

    await userEvent.click(screen.getByRole('button', { name: 'Add to the queue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Sintel' }));

    expect(onAdd).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('shows no add or remove control without the permissions', () => {
    renderQueue(LISTENER);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says the queue is empty', () => {
    render(
      <AppProviders>
        <PartyQueue.Empty />
      </AppProviders>
    );

    expect(screen.getByText('The queue is empty')).toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderQueue(DJ);

    expect(await axeViolations()).toEqual([]);
  });
});
