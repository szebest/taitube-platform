# @vp/permissions

Declarative authorization rules for the video pipeline, built on `@casl/ability`.

## Features
- **Isomorphic, no I/O:** runs in the browser, on Node 24 and on Bun 1.4.
- **Rule sets:** split across the video, comment, channel, upload and admin scopes.
- **Typed `canX` helpers:** action functions application code calls instead of the ability engine.
- **`assertCan`:** tells 401 UNAUTHORIZED (anonymous) from 403 FORBIDDEN (authenticated), with RFC 9457
  error details.
