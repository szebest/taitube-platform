import { type APIRequestContext, type Page, test as base, expect } from '@playwright/test';

import type { Persona, Stack } from './stack';

type WorkerFixtures = {
  stackUrl: string;
  stack: Stack;
};

type TestFixtures = {
  offMachineRequests: string[];
  signIn: (persona: Persona) => Promise<void>;
  api: (persona?: Persona) => Promise<APIRequestContext>;
};

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const AUTH_TOKEN_KEY = 'AUTH_TOKEN';

export const test = base.extend<TestFixtures, WorkerFixtures>({
  stackUrl: ['', { scope: 'worker', option: true }],

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

  signIn: async ({ page, stack }, use) => {
    await use(async (persona) => {
      await page.addInitScript(([key, token]) => window.localStorage.setItem(key, token), [
        AUTH_TOKEN_KEY,
        stack.personas[persona],
      ] as const);
    });
  },

  api: async ({ playwright, stack }, use) => {
    const contexts: APIRequestContext[] = [];
    await use(async (persona) => {
      const context = await playwright.request.newContext({
        baseURL: stack.apiUrl,
        extraHTTPHeaders: persona ? { authorization: `Bearer ${stack.personas[persona]}` } : {},
      });
      contexts.push(context);
      return context;
    });
    await Promise.all(contexts.map((context) => context.dispose()));
  },
});

export { expect, type Page };

export function videoCard(page: Page, videoId: string) {
  return page.locator(`a[href="/watch/${videoId}"]`);
}

export async function serverHtml(page: Page, path: string): Promise<string> {
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  return response.text();
}
