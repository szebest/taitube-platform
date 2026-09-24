import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const UNRESOLVED = new Set(['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT']);

function candidates(filePath) {
  const files = [`${filePath}.js`, `${filePath}.mjs`];
  if (statSync(filePath, { throwIfNoEntry: false })?.isDirectory()) {
    files.push(`${filePath}/index.js`, `${filePath}/index.mjs`);
  }
  return files;
}

function resolve(specifier, context, nextResolve) {
  try {
    return nextResolve(specifier, context);
  } catch (err) {
    if (!(UNRESOLVED.has(err?.code) && (specifier.startsWith('.') || specifier.startsWith('/')))) {
      throw err;
    }
    const base = context.parentURL
      ? new URL(context.parentURL)
      : pathToFileURL(`${process.cwd()}/`);
    const resolved = new URL(specifier, base);
    if (resolved.protocol !== 'file:') throw err;

    const found = candidates(fileURLToPath(resolved)).find((file) => existsSync(file));
    if (!found) throw err;
    return nextResolve(pathToFileURL(found).href, context);
  }
}

registerHooks({ resolve });
