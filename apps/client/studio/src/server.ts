import { fileURLToPath } from 'node:url';
import { withStaticAssets } from '@kit/security-headers/static-assets';
import handler, { createServerEntry } from '@tanstack/react-start/server-entry';

const CLIENT_BUILD = fileURLToPath(new URL('../client', import.meta.url));

export default createServerEntry({
  fetch: withStaticAssets({ dir: CLIENT_BUILD, hashedPrefix: '/assets/' }, (request) =>
    handler.fetch(request)
  ),
});
