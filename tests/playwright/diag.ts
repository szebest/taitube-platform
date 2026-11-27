import type { Page, TestInfo } from '@playwright/test';

export const collectConsole = (page: Page, pattern: RegExp) => {
  const lines: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (pattern.test(text)) lines.push(text);
  });
  return async (info: TestInfo, name: string) => {
    await info.attach(name, { body: lines.join('\n'), contentType: 'text/plain' });
    info.annotations.push({ type: name, description: lines.join('\n').slice(0, 60000) });
  };
};
