import Hls from 'hls.js';
import { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getSDK } from 'react-player/lib/utils';
import { useBundledHls } from '../use-bundled-hls';

vi.mock(import('react'), async (importOriginal) => {
  const react = await importOriginal();
  return { ...react, useEffect: vi.fn(react.useEffect) };
});

const REACT_PLAYER_HLS_SDK_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.1.4/dist/hls.min.js';

function Probe() {
  return <span>{`ready=${useBundledHls()}`}</span>;
}

describe('apps/web: useBundledHls', () => {
  it('holds the player back on the server and during hydration', () => {
    expect(renderToStaticMarkup(<Probe />)).toBe('<span>ready=false</span>');
  });

  it('hands react-player the bundled hls.js once mounted, so it never fetches the CDN copy', async () => {
    const browser = {};
    vi.stubGlobal('window', browser);
    vi.mocked(useEffect).mockImplementation((effect) => {
      effect();
    });
    const fetchScript = vi.fn();

    renderToStaticMarkup(<Probe />);
    await vi.waitFor(() => expect(browser).toHaveProperty('Hls', Hls));
    const sdk = await getSDK(REACT_PLAYER_HLS_SDK_URL, 'Hls', null, () => true, fetchScript);

    expect(sdk).toBe(Hls);
    expect(fetchScript).not.toHaveBeenCalled();
  });
});
