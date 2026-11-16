import { render } from '@testing-library/react';
import { createRenderCounter } from '@vp/web-testing/dom';
import { Tabs } from '..';

function renderCountedTabs() {
  const { Counted, commitsOf } = createRenderCounter();
  const parts = (
    <>
      <Counted id="list">
        <Tabs.List aria-label="Settings">
          <Tabs.Tab value="appearance">Appearance</Tabs.Tab>
          <Tabs.Tab value="playback">Playback</Tabs.Tab>
        </Tabs.List>
      </Counted>
      <Counted id="panel">
        <Tabs.Panel value="appearance">Theme and accent</Tabs.Panel>
      </Counted>
    </>
  );
  const tabs = () => <Tabs.Root defaultValue="appearance">{parts}</Tabs.Root>;
  const view = render(tabs());
  return { rerender: () => view.rerender(tabs()), commitsOf };
}

describe('@vp/ui: Tabs render count, compiled', () => {
  it.each(['list', 'panel'])(
    'commits the %s no more than at mount when the tabs render again with the same props',
    (part) => {
      const { rerender, commitsOf } = renderCountedTabs();

      const atMount = commitsOf(part);
      rerender();
      rerender();

      expect(commitsOf(part)).toBe(atMount);
    }
  );
});
