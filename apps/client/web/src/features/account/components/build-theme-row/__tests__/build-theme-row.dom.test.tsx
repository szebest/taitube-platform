import { fireEvent, screen } from '@testing-library/react';
import { readCookie, writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';
import { getRouter } from '#app/router';

const renderAppearance = () => renderRoute(getRouter, '/settings/appearance');

const saved = () => JSON.parse(readCookie('vp.appearance') ?? 'null');

const pick = async (name: string, hex: string) => {
  fireEvent.change(await screen.findByLabelText(name), { target: { value: hex } });
};

const use = () => screen.findByRole('button', { name: 'Use this theme' });

describe('apps/client/web: build your own theme', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies a theme that passes at once and keeps it in the cookie', async () => {
    const { user } = await renderAppearance();
    await pick('Page colour of your theme', '#101820');
    await pick('Accent of your theme', '#3366cc');

    expect(await screen.findByText(/Every text and outline pair/)).toBeInTheDocument();
    await user.click(await use());

    expect(saved()).toMatchObject({
      theme: 'custom',
      customGround: '#101820',
      customAccent: '#3366cc',
    });
    expect(document.documentElement).toHaveAttribute('data-theme', 'custom');
    expect(await screen.findByRole('radio', { name: 'Custom' })).toBeChecked();
  });

  it('says why a ground outside the accent band is refused and saves nothing', async () => {
    await renderAppearance();
    await pick('Page colour of your theme', '#808080');

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent(/pick a darker or lighter page colour/);
    expect(await use()).toBeDisabled();
    expect(saved()?.customGround ?? null).toBeNull();
    expect(document.documentElement).not.toHaveAttribute('data-theme', 'custom');
  });

  it.each([
    {
      name: 'colours the registry can rebuild',
      colours: { customGround: '#101820', customAccent: '#3366cc' },
      themeId: 'custom',
    },
    {
      name: 'a ground that fails the gate',
      colours: { customGround: '#808080', customAccent: '#3366cc' },
      themeId: 'sand',
    },
    { name: 'no colours at all', colours: {}, themeId: 'sand' },
  ])('after a reload with $name shows the $themeId theme', async ({ colours, themeId }) => {
    writeCookie('vp.appearance', JSON.stringify({ schema: 2, theme: 'custom', ...colours }), {
      maxAge: 60,
    });

    await renderAppearance();

    expect(
      await screen.findByRole('radio', { name: themeId === 'custom' ? 'Custom' : 'Sand' })
    ).toBeChecked();
  });
});
