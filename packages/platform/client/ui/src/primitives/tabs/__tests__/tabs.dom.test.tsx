import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Tabs } from '..';
import { variantNames } from '../../../lib/variant-names';
import type { TabsRootProps } from '../tabs';
import { tabsStyles } from '../tabs.variants';

const renderSettingsTabs = (props: TabsRootProps = {}) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Tabs.Root defaultValue="appearance" {...props}>
        <Tabs.List aria-label="Settings">
          <Tabs.Tab value="appearance">Appearance</Tabs.Tab>
          <Tabs.Tab value="playback">Playback</Tabs.Tab>
          <Tabs.Tab value="privacy" disabled>
            Privacy
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="appearance">Theme and accent</Tabs.Panel>
        <Tabs.Panel value="playback">Quality and speed</Tabs.Panel>
        <Tabs.Panel value="privacy">History</Tabs.Panel>
      </Tabs.Root>
    ),
  };
};

describe('@vp/ui: Tabs', () => {
  it.each(variantNames(tabsStyles.variants.variant))(
    'shows the selected panel of a %s list, named by its tab',
    (variant) => {
      renderSettingsTabs({ variant });

      expect(screen.getByRole('tablist', { name: 'Settings' })).toBeInTheDocument();
      expect(screen.getByRole('tabpanel', { name: 'Appearance' })).toHaveTextContent(
        'Theme and accent'
      );
    }
  );

  it.each([
    { keys: '{ArrowRight}', tab: 'Playback', panel: 'Quality and speed' },
    { keys: '{ArrowRight}{ArrowRight}', tab: 'Appearance', panel: 'Theme and accent' },
    { keys: '{End}', tab: 'Playback', panel: 'Quality and speed' },
  ])('moves with $keys to $tab, skipping a disabled tab', async ({ keys, tab, panel }) => {
    const { user } = renderSettingsTabs();
    await user.tab();

    await user.keyboard(keys);

    expect(screen.getByRole('tab', { name: tab })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: tab })).toHaveTextContent(panel);
  });

  it('passes axe', async () => {
    renderSettingsTabs();

    expect(await axeViolations()).toEqual([]);
  });
});
