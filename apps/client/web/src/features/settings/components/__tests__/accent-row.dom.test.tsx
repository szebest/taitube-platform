import { fireEvent, screen } from '@testing-library/react';
import { readCookie, writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

const renderAppearance = () => renderRoute(getRouter, '/settings/appearance');

const savedAccent = () => JSON.parse(readCookie('vp.appearance') ?? 'null')?.accent;

const pick = async (hex: string) => {
  fireEvent.change(await screen.findByLabelText('Pick a colour'), { target: { value: hex } });
};

describe('apps/client/web: the accent row', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it('shows the accent derived from a colour that fails contrast before anything is kept', async () => {
    await renderAppearance();

    await pick('#101010');

    expect(await screen.findByRole('status')).toHaveTextContent(/^Adjusted to #[0-9a-f]{6}/i);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
    expect(savedAccent()).toBeUndefined();
  });

  it('keeps the colour on confirm, and the theme accent again on its own button', async () => {
    const { user } = await renderAppearance();
    await pick('#3b82f6');

    await user.click(screen.getByRole('button', { name: 'Use this accent' }));

    expect(savedAccent()).toBe('#3b82f6');
    expect(screen.queryByRole('button', { name: 'Use this accent' })).toBeNull();

    await user.click(screen.getByRole('button', { name: "Use the theme's accent" }));

    expect(savedAccent()).toBeNull();
    expect(screen.getByRole('button', { name: "Use the theme's accent" })).toBeDisabled();
  });
});
