import Hls from 'hls.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { getSDK } from 'react-player/lib/utils';
import { provideBundledHls, useBundledHls } from '../use-bundled-hls';

const REACT_PLAYER_HLS_SDK_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.1.4/dist/hls.min.js';

describe('apps/web: useBundledHls', () => {
  it('hands react-player the bundled hls.js, so it never fetches the CDN copy', async () => {
    const browser = {};
    vi.stubGlobal('window', browser);
    const fetchScript = vi.fn();

    provideBundledHls(browser, Hls);
    const sdk = await getSDK(REACT_PLAYER_HLS_SDK_URL, 'Hls', null, () => true, fetchScript);

    expect(sdk).toBe(Hls);
    expect(fetchScript).not.toHaveBeenCalled();
  });

  it('holds the player back on the server and during hydration', () => {
    function Probe() {
      return <span>{`ready=${useBundledHls()}`}</span>;
    }

    expect(renderToStaticMarkup(<Probe />)).toBe('<span>ready=false</span>');
  });
});
