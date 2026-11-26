import { Button, useUiCopy } from '@kit/ui';
import { composeStory } from '@storybook/react-vite';
import { render, screen } from '@testing-library/react';
import { useT as useStudioT } from '../../../../../apps/client/studio/src/lib/messages';
import { useT as useWebT } from '../../../../../apps/client/web/src/lib/messages';
import { loadCatalogue, withAppearance } from '../decorator';
import { initialAppearanceGlobals } from '../toolbars';

function CloseButton() {
  return <Button>{useUiCopy().close}</Button>;
}

function StudioLegend() {
  return <p>{useStudioT().tOr('appUi.legend', {}, '')}</p>;
}

function WebNavigation() {
  return <p>{useWebT().tOr('appUi.navigation', {}, '')}</p>;
}

const renderStory = async (
  globals: Record<string, string>,
  { title = 'Probe', render: Probe = CloseButton } = {}
) => {
  const Story = composeStory(
    { render: () => <Probe /> },
    { title },
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

  it.each([
    { title: 'Studio/Probe', Probe: StudioLegend, locale: 'en', word: 'Legend' },
    { title: 'Studio/Probe', Probe: StudioLegend, locale: 'pl', word: 'Legenda' },
    { title: 'Web/Probe', Probe: WebNavigation, locale: 'en', word: 'Main' },
    { title: 'Web/Probe', Probe: WebNavigation, locale: 'pl', word: 'Główne' },
  ])(
    'hands a $title story its own app translator in $locale',
    async ({ title, Probe, locale, word }) => {
      await renderStory({ ...initialAppearanceGlobals, locale }, { title, render: Probe });

      expect(screen.getByText(word)).toBeInTheDocument();
    }
  );
});
