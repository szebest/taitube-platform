import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Tabs } from '..';

function renderSettingsTabs() {
  const trace: string[] = [];
  render(
    <Tabs.Root defaultValue="appearance" onValueChange={(value) => trace.push(`value ${value}`)}>
      <Tabs.List aria-label="Settings">
        <Tabs.Tab value="appearance">Appearance</Tabs.Tab>
        <Tabs.Tab value="playback">Playback</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="appearance">Theme and accent</Tabs.Panel>
      <Tabs.Panel value="playback">Quality and speed</Tabs.Panel>
    </Tabs.Root>
  );
  return {
    user: userEvent.setup(),
    snapshot: () => ({ dom: document.body.innerHTML, trace: [...trace] }),
  };
}

describe('@vp/ui: Tabs, compiled and uncompiled', () => {
  it('renders and switches panels the same way in both builds', async () => {
    const { user, snapshot } = renderSettingsTabs();
    const steps = [snapshot()];

    await user.click(screen.getByRole('tab', { name: 'Playback' }));
    steps.push(snapshot());
    await user.keyboard('{ArrowLeft}');
    steps.push(snapshot());

    expect(steps).toMatchSnapshot();
  });
});
