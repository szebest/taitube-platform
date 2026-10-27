import { account } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

export const CHANNEL = `/channel/${account().channel.id}`;

export function renderShell(url: string, signedIn: boolean) {
  const handlers = signedIn ? [signInBrowser(), ...loaderApi()] : loaderApi();
  return renderRoute(getRouter, url, { handlers });
}
