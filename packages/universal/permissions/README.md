# @vp/permissions

Pure functional declarative authorization engine powered by `@casl/ability` for the video pipeline platform.

## Features
- **Isomorphic & Zero-I/O:** runs in the browser, on Node 24 and on Bun 1.4, with no I/O.
- **Pure Functional Rule Sets:** Modular rules partitioned across video, comment, channel, upload, and admin domain scopes.
- **Typed `canX` Helpers:** Library-agnostic action functions shielding application code from raw ability engines.
- **RFC 9457 Error Guard (`assertCan`):** Automatically distinguishes 401 UNAUTHORIZED (anonymous) vs 403 FORBIDDEN (authenticated) with structured contextual details.
