# @kit/tsconfig

Shared TypeScript presets. JSON only: no source, no build.

Install: `pnpm add -D @kit/tsconfig`. No peers.

| Preset | For |
|---|---|
| `base.json` | the strict settings every other preset extends |
| `universal.json` | code that runs in a browser and on a server |
| `client.json` | browser-only code |
| `server.json` | Node and Bun code |
| `spec.json` | a package's `tsconfig.spec.json` |
| `build.json` | a package's `tsconfig.build.json` |

Tokens: none. Registries: none.

```json
{
  "extends": "@kit/tsconfig/universal.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*"]
}
```
