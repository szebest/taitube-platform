import { renderToStaticMarkup } from 'react-dom/server';
import { storeValue } from '../../../../__tests__/stored-value';
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
  it('shows the grid when the viewer never chose', () => {
    expect(renderView()).toContain('grid');
  });

  it('shows the list the viewer chose last time', () => {
    storeValue(IN_VIEW_LOCAL_STORAGE_KEY, true);

    expect(renderView()).toContain('list');
  });

  it('remembers a new choice for the next render', () => {
    const controls: ViewControls = {};
    renderView(controls);

    controls.setIsListView?.(true);

    expect(renderView()).toContain('list');
  });
});
