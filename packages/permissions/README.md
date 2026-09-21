# @vp/permissions

Pure functional declarative authorization engine powered by `@casl/ability` for the video pipeline platform.

## Features
- **Isomorphic & Zero-I/O:** 100% dual-runtime compatible across Node 24 and Bun 1.4.
- **Pure Functional Rule Sets:** Modular rules partitioned across video, comment, channel, upload, and admin domain scopes.
- **Typed `canX` Helpers:** Library-agnostic action functions shielding application code from raw ability engines.
- **RFC 9457 Error Guard (`assertCan`):** Automatically distinguishes 401 UNAUTHORIZED (anonymous) vs 403 FORBIDDEN (authenticated) with structured contextual details.
- **Zod Validation Adapter:** Converts schema issues into RFC 9457 `invalidParams`.
