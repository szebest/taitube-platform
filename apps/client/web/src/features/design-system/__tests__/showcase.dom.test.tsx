import { screen, within } from '@testing-library/react';

import { renderRoute } from '#app/__tests__/render-route';
import { THEMES } from '#app/components/ui/theme/theme-preference';

const PRIMITIVES = [
  'Button',
  'Field, Input, Textarea',
  'Select',
  'Checkbox, Switch, Label',
  'Badge',
  'Avatar',
  'Card, Separator',
  'Skeleton',
  'Spinner, Progress',
  'Dialog',
  'Sheet',
  'DropdownMenu, ThemeMenu',
  'Tooltip',
  'Tabs',
  'Toast',
];

describe('apps/client/web: design system showcase', () => {
  it.each(THEMES)('shows every primitive in the %s theme', async (theme) => {
    await renderRoute('/design-system');

    const pane = (await screen.findByText(`${theme} theme`)).parentElement as HTMLElement;
    expect(pane).toHaveAttribute('data-theme', theme);
    expect(
      within(pane)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent)
    ).toEqual(PRIMITIVES);
  });

  it('shows a toast from the root provider', async () => {
    const { user } = await renderRoute('/design-system');

    const [showNeutral] = await screen.findAllByRole('button', { name: 'Show neutral' });
    await user.click(showNeutral as HTMLElement);

    expect(await screen.findByText('A neutral toast')).toBeInTheDocument();
  });
});
