import { composeStory } from '@storybook/react-vite';
import { render, screen } from '@testing-library/react';
import { Button, useUiCopy } from '@vp/ui';
import { loadCatalogue, withAppearance } from '../decorator';
import { initialAppearanceGlobals } from '../toolbars';

function CloseButton() {
  return <Button>{useUiCopy().close}</Button>;
}

const renderStory = async (globals: Record<string, string>) => {
  const Story = composeStory(
    { render: () => <CloseButton /> },
    { title: 'Probe' },
    { decorators: [withAppearance], loaders: [loadCatalogue], initialGlobals: globals }
  );
  await Story.load();
  return render(<Story />);
};

describe('@vp/workbench: withAppearance', () => {
  it('puts the toolbars appearance on <html> the way the apps document does, around the story', async () => {
    await renderStory({
      ...initialAppearanceGlobals,
      theme: 'nocturne',
      mode: 'light',
      spacing: 'airy',
      direction: 'rtl',
    });

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.dataset).toMatchObject({
      theme: 'nocturne',
      mode: 'light',
      spacing: 'airy',
      radius: 'sharp',
    });
  });

  it.each([
    { locale: 'en', close: 'Close' },
    { locale: 'pl', close: 'Zamknij' },
  ])(
    'words the story in the $locale catalogue and puts the locale on <html>',
    async ({ locale, close }) => {
      await renderStory({ ...initialAppearanceGlobals, locale });

      expect(screen.getByRole('button', { name: close })).toBeInTheDocument();
      expect(document.documentElement.lang).toBe(locale);
    }
  );
});
