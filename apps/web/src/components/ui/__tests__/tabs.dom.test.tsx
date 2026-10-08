import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs';

function SettingsTabs() {
  return (
    <Tabs defaultValue="appearance">
      <TabsList aria-label="Settings">
        <TabsTrigger value="appearance">Appearance</TabsTrigger>
        <TabsTrigger value="playback">Playback</TabsTrigger>
        <TabsTrigger value="privacy" disabled>
          Privacy
        </TabsTrigger>
      </TabsList>
      <TabsContent value="appearance">Theme and accent</TabsContent>
      <TabsContent value="playback">Quality and speed</TabsContent>
      <TabsContent value="privacy">History</TabsContent>
    </Tabs>
  );
}

describe('apps/web: Tabs', () => {
  it('shows the selected tab panel, named by its tab', () => {
    render(<SettingsTabs />);

    expect(screen.getByRole('tablist', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Appearance' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tabpanel', { name: 'Appearance' })).toHaveTextContent(
      'Theme and accent'
    );
  });

  it.each([
    { keys: '{ArrowRight}', tab: 'Playback', panel: 'Quality and speed' },
    { keys: '{ArrowRight}{ArrowRight}', tab: 'Appearance', panel: 'Theme and accent' },
    { keys: '{End}', tab: 'Playback', panel: 'Quality and speed' },
  ])('moves with $keys to $tab, skipping a disabled tab', async ({ keys, tab, panel }) => {
    render(<SettingsTabs />);
    await userEvent.tab();

    await userEvent.keyboard(keys);

    expect(screen.getByRole('tab', { name: tab })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: tab })).toHaveTextContent(panel);
    expect(screen.getByRole('tab', { name: tab })).toHaveClass('tw:focus-ring');
  });

  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    render(<SettingsTabs />);

    expect(await axeViolations(theme)).toEqual([]);
  });
});
