import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { WithUiCopy } from '../../__tests__/ui-copy-fixture';
import { readCookie, writeCookie } from '../../cookies/cookie';
import { TooltipProvider } from '../../tooltip';
import { DEFAULT_APPEARANCE } from '../preference';
import { AppearanceProvider, useAppearance } from '../provider';
import { ThemeMenu } from '../theme-menu';
import { stubMediaQueries } from './media-queries';

function Shown() {
  const { resolved, shownMode } = useAppearance();
  const { spacing, sizing } = resolved.sets;
  return <output>{`${resolved.theme.id} ${shownMode} ${spacing.id} ${sizing.id}`}</output>;
}

async function openMenu() {
  stubMediaQueries({ scheme: 'dark' });
  render(
    <WithUiCopy>
      <AppearanceProvider stored={{ preference: DEFAULT_APPEARANCE, source: 'none' }}>
        <TooltipProvider>
          <ThemeMenu />
        </TooltipProvider>
        <Shown />
      </AppearanceProvider>
    </WithUiCopy>
  );
  await userEvent.tab();
  await userEvent.keyboard('{Enter}');
}

describe('@vp/ui: ThemeMenu', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it('checks the current theme and mode, and switches to the ones picked', async () => {
    await openMenu();
    expect(screen.getByRole('menuitemradio', { name: 'Sand' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toBeChecked();

    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Nocturne' }));
    await userEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Light' }));

    expect(screen.getByRole('status')).toHaveTextContent('nocturne light default medium');
    expect(JSON.parse(readCookie('vp.appearance') ?? 'null')).toMatchObject({
      theme: 'nocturne',
      mode: 'light',
    });
  });

  it('sets compact spacing and small sizing together, and back to the theme own', async () => {
    await openMenu();

    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Compact' }));
    expect(screen.getByRole('status')).toHaveTextContent('sand dark compact small');
    await userEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Comfortable' }));

    expect(screen.getByRole('status')).toHaveTextContent('sand dark default medium');
  });

  it('passes axe open', async () => {
    await openMenu();

    expect(await axeViolations()).toEqual([]);
  });
});
