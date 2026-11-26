import { dump, loadAll } from 'js-yaml';

interface LockfileDocument {
  importers?: Record<string, unknown>;
}

/**
 * The repository's lockfile cut down to the sandbox: its importers are the closure's packages and a
 * root with no dependencies, so a frozen install reads every resolution from it and needs no registry
 * metadata. The package entries stay; pnpm installs only what the importers reach.
 */
export function pruneLockfile(text: string, dirs: readonly string[]): string {
  return loadAll(text)
    .map((document) => {
      const { importers } = document as LockfileDocument;
      if (importers === undefined || !Object.keys(importers).some((dir) => dir !== '.'))
        return document;
      const kept = Object.entries(importers).filter(([dir]) => dirs.includes(dir));
      return { ...(document as object), importers: Object.fromEntries([['.', {}], ...kept]) };
    })
    .map((document) => `---\n${dump(document, { lineWidth: -1 })}`)
    .join('\n');
}

interface PackageEntry {
  resolution?: { integrity?: string; tarball?: string };
}

/**
 * A packed tarball's bytes change with every build, so the app's lockfile names each local tarball
 * without the integrity a frozen install would otherwise hold it to.
 */
export function withoutTarballIntegrity(text: string): string {
  return loadAll(text)
    .map((document) => {
      const { packages } = document as { packages?: Record<string, PackageEntry> };
      for (const entry of Object.values(packages ?? {})) {
        if (entry.resolution?.tarball?.startsWith('file:')) delete entry.resolution.integrity;
      }
      return `---\n${dump(document, { lineWidth: -1 })}`;
    })
    .join('\n');
}

const packageKeys = (text: string): Set<string> =>
  new Set(
    loadAll(text).flatMap((document) =>
      Object.keys((document as { packages?: object }).packages ?? {})
    )
  );

/**
 * The app's locked packages the repository's lockfile does not lock, the tarballs aside: the store CI
 * restores holds only what the repository locks, so each would send the offline install to a registry.
 */
export function unlockedPackages(appLockfile: string, repoLockfile: string): string[] {
  const locked = packageKeys(repoLockfile);
  return [...packageKeys(appLockfile)].filter((key) => !key.includes('@file:') && !locked.has(key));
}
