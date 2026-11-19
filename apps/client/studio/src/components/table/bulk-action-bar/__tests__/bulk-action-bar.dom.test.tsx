import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { BulkActionBar } from '../index';

const renderBar = ({ pending = false, onApprove = vi.fn(), onDisclosure = vi.fn() } = {}) =>
  render(
    <BulkActionBar.Root aria-label="Moderate" pending={pending}>
      <BulkActionBar.Action onClick={onApprove}>Approve</BulkActionBar.Action>
      <BulkActionBar.Disclosure value="silent" onValueChange={onDisclosure} />
    </BulkActionBar.Root>,
    { wrapper: AppProviders }
  );

describe('apps/client/studio: BulkActionBar', () => {
  it('runs an action and reports the disclosure picked', async () => {
    const onApprove = vi.fn();
    const onDisclosure = vi.fn();
    renderBar({ onApprove, onDisclosure });

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Visible' }));

    expect(onApprove).toHaveBeenCalledOnce();
    expect(onDisclosure).toHaveBeenCalledWith('visible');
  });

  it('holds every action and the disclosure while a batch runs', () => {
    renderBar({ pending: true });

    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Visible' })).toBeDisabled();
  });

  it('passes axe', async () => {
    renderBar();

    expect(await axeViolations()).toEqual([]);
  });
});
