import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { VisuallyHidden } from '../visually-hidden';

const renderNotificationsButton = () =>
  render(
    <button type="button">
      <svg aria-hidden="true" />
      <VisuallyHidden>Notifications</VisuallyHidden>
    </button>
  );

describe('@vp/ui: VisuallyHidden', () => {
  it('names a control for assistive technology while it stays off the screen', () => {
    renderNotificationsButton();

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toHaveStyle({ position: 'absolute', width: '1px' });
  });

  it('passes axe', async () => {
    renderNotificationsButton();

    expect(await axeViolations()).toEqual([]);
  });
});
