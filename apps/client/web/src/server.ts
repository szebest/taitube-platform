import { fileURLToPath } from 'node:url';
import handler, { createServerEntry } from '@tanstack/react-start/server-entry';
import { withStaticAssets } from '@vp/security-headers/static-assets';

const CLIENT_BUILD = fileURLToPath(new URL('../client', import.meta.url));

export default createServerEntry({
  fetch: withStaticAssets(CLIENT_BUILD, (request) => handler.fetch(request)),
});
