import { ApiError } from '@vp/api-client';
import { isQueuedByWorker } from '../is-queued-by-worker';

function controlledBy(controller: object | null) {
  Object.defineProperty(navigator, 'serviceWorker', { value: { controller }, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('apps/client/web: isQueuedByWorker', () => {
  it.each([
    {
      name: 'a network error under a controlling worker',
      error: new TypeError('x'),
      controller: {},
      expected: true,
    },
    {
      name: 'a network error with no controlling worker',
      error: new TypeError('x'),
      controller: null,
      expected: false,
    },
    {
      name: 'a server answer under a controlling worker',
      error: new ApiError(500, 'INTERNAL', 'x'),
      controller: {},
      expected: false,
    },
  ])('is $expected for $name', ({ error, controller, expected }) => {
    controlledBy(controller);

    expect(isQueuedByWorker(error)).toBe(expected);
  });

  it('is false where the browser has no service workers', () => {
    expect(isQueuedByWorker(new TypeError('x'))).toBe(false);
  });
});
