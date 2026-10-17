import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';
import { z } from 'zod';

const remember = createServerFn()
  .inputValidator(z.object({ value: z.string() }))
  .handler(({ data }) => {
    setCookie('kept', data.value, { httpOnly: true, path: '/' });
  });

const recall = createServerFn().handler(() => getCookie('kept') ?? null);

// jsdom.setup installs `overCookieRequest` as Start's `createServerFn`.
describe('@vp/web-testing: server functions in the browser', () => {
  it('carries the cookies a server function set to the next one, as the browser would', async () => {
    await remember({ data: { value: 'from-the-server' } });

    expect(await recall()).toBe('from-the-server');
  });

  it('refuses input its validator refuses, before the handler runs', async () => {
    // @ts-expect-error a value the browser could send though the types refuse it
    await expect(remember({ data: { value: 42 } })).rejects.toThrow();
    expect(await recall()).toBeNull();
  });

  it('rejects with what the handler threw', async () => {
    const failing = createServerFn().handler(() => {
      throw new Error('refused');
    });

    await expect(failing()).rejects.toThrow('refused');
  });
});
