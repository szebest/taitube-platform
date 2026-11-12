import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  type APIRequestContext,
  type Locator,
  type Page,
  test as base,
  expect,
} from '@playwright/test';
import { mintToken } from '../../packages/server/dev-token/src/index';
import { sessionCookie } from './session-cookie';
import type { Persona, Stack } from './stack';

/** The short clip every browser flow uploads; `pnpm gen-video --only s2` writes it. */
export const FIXTURE_VIDEO = fileURLToPath(new URL('../fixtures/s2.mp4', import.meta.url));

type WorkerFixtures = {
  stackUrl: string;
  stack: Stack;
  /** The other client app's origin, when the suite serves it alongside (`alongside` in its config). */
  alongsideUrl: string;
  /** This app's dev server, which hydrates only while no client module reaches a server-only import. */
  devUrl: string;
};

/** `stranger` is a viewer this test alone signs in as, for state no other test may share. */
type TestPersona = Persona | 'stranger';

type TestFixtures = {
  offMachineRequests: string[];
  tokens: Record<TestPersona, string>;
  signIn: (persona: TestPersona) => Promise<void>;
  /** `channelId` acts on that channel through `X-Channel-Id`, as the studio does for a team member. */
  api: (persona?: TestPersona, options?: { channelId?: string }) => Promise<APIRequestContext>;
};

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export const test = base.extend<TestFixtures, WorkerFixtures>({
  stackUrl: ['', { scope: 'worker', option: true }],
  alongsideUrl: ['', { scope: 'worker', option: true }],
  devUrl: ['', { scope: 'worker', option: true }],

  stack: [
    async ({ playwright, stackUrl }, use) => {
      const control = await playwright.request.newContext();
      const response = await control.get(stackUrl);
      expect(response.ok(), `the e2e stack answers on ${stackUrl}`).toBe(true);
      await use((await response.json()) as Stack);
      await control.dispose();
    },
    { scope: 'worker' },
  ],

  offMachineRequests: [
    async ({ context }, use) => {
      const offMachine: string[] = [];
      const leavesTheMachine = (url: URL) => !LOCAL_HOSTS.has(url.hostname);
      await context.route(leavesTheMachine, (route) => {
        offMachine.push(route.request().url());
        return route.abort('blockedbyclient');
      });
      await context.routeWebSocket(leavesTheMachine, (socket) => {
        offMachine.push(socket.url());
        return socket.close();
      });
      await use(offMachine);
      expect(offMachine, 'requests that left the machine').toEqual([]);
    },
    { auto: true },
  ],

  tokens: async ({ stack }, use) => {
    await use({ ...stack.personas, stranger: mintToken({ sub: randomUUID() }) });
  },

  signIn: async ({ context, tokens, baseURL }, use) => {
    await use(async (persona) => {
      await context.addCookies([sessionCookie(tokens[persona], baseURL ?? '')]);
    });
  },

  api: async ({ playwright, stack, tokens }, use) => {
    const contexts: APIRequestContext[] = [];
    await use(async (persona, { channelId } = {}) => {
      const context = await playwright.request.newContext({
        baseURL: stack.apiUrl,
        extraHTTPHeaders: {
          ...(persona && { authorization: `Bearer ${tokens[persona]}` }),
          ...(channelId && { 'x-channel-id': channelId }),
        },
      });
      contexts.push(context);
      return context;
    });
    await Promise.all(contexts.map((context) => context.dispose()));
  },
});

export { expect, type Page, type Persona, type Stack };

export async function serverHtml(page: Page, path: string): Promise<string> {
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  return response.text();
}

/** Resolves once React has hydrated the element: a click before that is a full page load, or lost. */
export async function hydrated(locator: Locator): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate((element) =>
        Object.keys(element).some((key) => key.startsWith('__reactFiber'))
      )
    )
    .toBe(true);
}
