import { clientApps } from './client-apps';
import type { Row } from './zero-matches-rows';

const APPS = clientApps();

/** The pathspec `suffix` under every client app. */
function inEachApp(suffix: string): string[] {
  return APPS.map((app) => `:(glob)${app}/${suffix}`);
}

function exceptInEachApp(path: string): string[] {
  return APPS.map((app) => `:(exclude)${app}/${path}`);
}

/** The rows every app under `apps/client/` is held to; the app list is `client-apps.ts`. */
export const WEB_ROWS: readonly Row[] = [
  {
    name: 'a client app module reading the build environment outside src/config (the dev-only gates in __root.tsx and login.tsx read import.meta.env.DEV themselves, or Rolldown ships their dead chunks)',
    pattern: /import\.meta\.env/g,
    scope: [
      ...inEachApp('src/**/*.ts'),
      ...inEachApp('src/**/*.tsx'),
      ...exceptInEachApp('src/config/index.ts'),
      ...exceptInEachApp('src/routes/__root.tsx'),
      ...exceptInEachApp('src/routes/login.tsx'),
      ...APPS.map((app) => `:(exclude,glob)${app}/src/**/__tests__/**`),
    ],
    expected: 0,
    fires: 'const base = import.meta.env.VITE_API_BASE_URL;',
  },
  {
    name: 'a client app import through the retired src/ alias instead of #app/',
    pattern: /(?:\bfrom|\bimport\(?|[mM]ock\(|importActual\(|@import|@use|@forward)\s*['"]src\//g,
    scope: [...inEachApp('**/*.ts'), ...inEachApp('**/*.tsx'), ...inEachApp('**/*.scss')],
    expected: 0,
    fires: "import { API_BASE_URL } from 'src/config';",
  },
  {
    name: 'a client app source climbing two or more directories instead of #app/ (the Playwright suite under e2e/ reaches the root tests/ module that way, and is not held to it)',
    pattern: /(?:\bfrom|\bimport\(?|[mM]ock\(|importActual\()\s*['"](?:\.\.\/){2,}/g,
    scope: [...inEachApp('src/**/*.ts'), ...inEachApp('src/**/*.tsx')],
    expected: 0,
    fires: "vi.doMock('../../../modules/shared/api', () => ({}));",
  },
  {
    name: 'a route component wrapped in lazy or lazyRouteComponent, which the Start splitter already splits (only a dev-only gate on import.meta.env.DEV, in __root.tsx and login.tsx, takes React.lazy)',
    pattern: /\blazyRouteComponent\b|\blazy\(/g,
    scope: [
      ...inEachApp('src/routes/**/*.tsx'),
      ...APPS.map((app) => `:(exclude,glob)${app}/src/**/__tests__/**`),
      ...exceptInEachApp('src/routes/__root.tsx'),
      ...exceptInEachApp('src/routes/login.tsx'),
    ],
    expected: 0,
    fires: "component: lazyRouteComponent(() => import('#app/features/x/page'), 'Page'),",
  },
  {
    name: 'a client app module importing the playback engine (@videojs/*, hls.js) outside features/player/engine/video-js-engine.tsx and the player specs, which stand hls.js in for the network: everything else plays through <TaitubePlayer /> and its own types, so the engine swaps in one file',
    pattern: /['"](?:@videojs\/[^'"]*|hls\.js(?:\/[^'"]*)?)['"]/g,
    scope: [
      ...inEachApp('src/**/*.ts'),
      ...inEachApp('src/**/*.tsx'),
      ...exceptInEachApp('src/features/player/engine/video-js-engine.tsx'),
      ...APPS.map((app) => `:(exclude,glob)${app}/src/features/player/**/__tests__/**`),
    ],
    expected: 0,
    fires: "import Hls from 'hls.js/light';",
  },
  {
    name: 'a client app dependency on Redux or react-hook-form, which TanStack Query and Form replaced',
    pattern: /['"](?:@reduxjs\/toolkit|react-redux|react-hook-form)(?:\/[^'"]*)?['"]/g,
    scope: [
      ...inEachApp('**/*.ts'),
      ...inEachApp('**/*.tsx'),
      ...APPS.map((app) => `${app}/package.json`),
    ],
    expected: 0,
    fires: "import { createApi } from '@reduxjs/toolkit/query/react';",
  },
  {
    name: 'markup injected as HTML in a client app, where user text renders as React text',
    pattern: /dangerouslySetInnerHTML/g,
    scope: [...inEachApp('src/**/*.tsx'), ...inEachApp('src/**/*.ts')],
    expected: 0,
    fires: '<p dangerouslySetInnerHTML={{ __html: video.description }} />',
  },
  {
    name: 'a token kept in browser storage, where a script can read it (the session is an httpOnly cookie)',
    pattern: /\b(?:localStorage|sessionStorage)\b[^\n]*(?:token|session|AUTH_)/gi,
    scope: [
      ...inEachApp('src/**/*.ts'),
      ...inEachApp('src/**/*.tsx'),
      ':(glob)packages/client/*/src/**/*.ts',
      ':(glob)packages/client/*/src/**/*.tsx',
    ],
    expected: 0,
    fires: "const token = window.localStorage.getItem('AUTH_TOKEN');",
  },
];
