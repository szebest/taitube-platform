import { queueableNetworkMode } from '../queueable-network-mode';

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('apps/client/web: queueableNetworkMode', () => {
  it.each([
    { name: 'a worker controls the page', controller: {}, expected: 'always' },
    { name: 'no worker controls the page', controller: null, expected: 'online' },
  ])('is $expected when $name', ({ controller, expected }) => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { controller },
      configurable: true,
    });

    expect(queueableNetworkMode()).toBe(expected);
  });

  it("is 'online' where the browser has no service workers", () => {
    expect(queueableNetworkMode()).toBe('online');
  });
});
