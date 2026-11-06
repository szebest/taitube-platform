import { renderToString } from 'react-dom/server';
import { lazyComponent } from '../lazy-component';

const Greeting = () => <p>Hello</p>;

describe('@vp/ui: lazyComponent on the server', () => {
  it('renders the fallback before the module has loaded and the component after, with no window, in the same boundary either way', async () => {
    const Lazy = lazyComponent(async () => ({ default: Greeting }), {
      name: 'Greeting',
      pick: (module: { default: typeof Greeting }) => module.default,
      fallback: <i>Loading</i>,
    });

    expect(typeof window).toBe('undefined');
    expect(renderToString(<Lazy />)).toContain('Loading');
    await Lazy.preload();
    expect(renderToString(<Lazy />)).toContain('<p>Hello</p>');
    expect(renderToString(<Lazy />)).toContain('<!--$-->');
  });

  it('reports an import failure as it is, since only a browser can reload', async () => {
    const failure = new TypeError('Failed to fetch dynamically imported module: /a.js');
    const Lazy = lazyComponent(
      async () => {
        throw failure;
      },
      {
        name: 'Greeting',
        pick: (module: { default: typeof Greeting }) => module.default,
        retry: { attempts: 0, baseDelayMs: 0 },
      }
    );

    await expect(Lazy.preload()).rejects.toBe(failure);
  });
});
