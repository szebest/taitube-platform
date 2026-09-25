import { renderToStaticMarkup } from 'react-dom/server';
import { stubBrowser } from '../../../../__tests__/browser';
import { IN_VIEW_LOCAL_STORAGE_KEY } from '../../../../config';
import { useIsView } from '../useInView';

type ViewControls = { setIsListView?: (isListView: boolean) => void };

function renderView(controls: ViewControls = {}): string {
  function ViewProbe() {
    const [isListView, setIsListView] = useIsView();
    controls.setIsListView = setIsListView;
    return <span>{isListView ? 'list' : 'grid'}</span>;
  }

  return renderToStaticMarkup(<ViewProbe />);
}

describe('apps/web: list or grid view preference', () => {
  it('server-renders the grid, whatever the viewer chose', () => {
    stubBrowser({ stored: { [IN_VIEW_LOCAL_STORAGE_KEY]: 'true' } });

    expect(renderView()).toContain('grid');
  });

  it('remembers a new choice', () => {
    const storage = stubBrowser();
    const controls: ViewControls = {};
    renderView(controls);

    controls.setIsListView?.(true);

    expect(storage.get(IN_VIEW_LOCAL_STORAGE_KEY)).toBe('true');
  });
});
