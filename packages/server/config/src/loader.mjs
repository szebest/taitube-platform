import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      err &&
      (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ERR_UNSUPPORTED_DIR_IMPORT') &&
      (specifier.startsWith('.') || specifier.startsWith('/'))
    ) {
      const base = context.parentURL
        ? new URL(context.parentURL)
        : pathToFileURL(`${process.cwd()}/`);
      const resolved = new URL(specifier, base);
      if (resolved.protocol === 'file:') {
        const filePath = fileURLToPath(resolved);
        if (existsSync(`${filePath}.js`)) {
          return nextResolve(pathToFileURL(`${filePath}.js`).href, context);
        }
        if (existsSync(`${filePath}.mjs`)) {
          return nextResolve(pathToFileURL(`${filePath}.mjs`).href, context);
        }
        if (existsSync(filePath)) {
          try {
            if (statSync(filePath).isDirectory()) {
              if (existsSync(`${filePath}/index.js`)) {
                return nextResolve(pathToFileURL(`${filePath}/index.js`).href, context);
              }
              if (existsSync(`${filePath}/index.mjs`)) {
                return nextResolve(pathToFileURL(`${filePath}/index.mjs`).href, context);
              }
            }
          } catch {
            // Ignore stat error
          }
        }
      }
    }
    throw err;
  }
}
