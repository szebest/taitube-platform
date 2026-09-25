import Hls from 'hls.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { getSDK } from 'react-player/lib/utils';
import { asLivePage } from '../../../../__tests__/live-page';
import { useBundledHls } from '../use-bundled-hls';

const REACT_PLAYER_HLS_SDK_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.1.4/dist/hls.min.js';

function Probe() {
  return <span>{`ready=${useBundledHls()}`}</span>;
}

describe('apps/web: useBundledHls', () => {
  it('holds the player back on the server and during hydration', () => {
    expect(renderToStaticMarkup(<Probe />)).toBe('<span>ready=false</span>');
  });

  it('hands react-player the bundled hls.js once live, so it never fetches the CDN copy', async () => {
    const browser = {};
    vi.stubGlobal('window', browser);
    const fetchScript = vi.fn();

    asLivePage(() => renderToStaticMarkup(<Probe />));
    await vi.waitFor(() => expect(browser).toHaveProperty('Hls', Hls));
    const sdk = await getSDK(REACT_PLAYER_HLS_SDK_URL, 'Hls', null, () => true, fetchScript);

    expect(sdk).toBe(Hls);
    expect(fetchScript).not.toHaveBeenCalled();
  });
});
