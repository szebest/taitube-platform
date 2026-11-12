import { parseJson } from '@vp/result';
import { z } from 'zod';
import { EXIT, type ExitCode } from './exit-codes';
import type { DeployHost } from './host';
import { migrationFindings, MIGRATIONS_DIR, parseNameStatus } from './migrations';
import { expiredPreviews, previewSlug } from './preview';

const Namespaces = z.object({
  items: z.array(
    z.object({
      metadata: z.object({
        name: z.string(),
        annotations: z.record(z.string(), z.string()).optional(),
      }),
    })
  ),
});

export function migrationsCheck(host: DeployHost, base: string): ExitCode {
  const range = host.git(['merge-base', base, 'HEAD']);
  if (range === undefined) {
    host.print(`cannot find a merge base with ${base}: fetch it, or pass --base <ref>`);
    return EXIT.prerequisite;
  }
  const baseSha = range.trim();
  const diff =
    host.git(['diff', '--name-status', '--no-renames', baseSha, 'HEAD', '--', MIGRATIONS_DIR]) ??
    '';
  const journalPath = `${MIGRATIONS_DIR}/meta/_journal.json`;
  const findings = migrationFindings(parseNameStatus(diff), {
    base: host.git(['show', `${baseSha}:${journalPath}`]),
    head: host.readText(journalPath),
  });
  host.print(
    findings.length > 0 ? findings.join('\n') : `migrations are forward-only against ${base}`
  );
  return findings.length > 0 ? EXIT.failure : EXIT.ok;
}

export function slug(host: DeployHost, ref: string | undefined): ExitCode {
  if (ref === undefined || ref === '') {
    host.print('preview-slug takes a branch name or a PR reference');
    return EXIT.usage;
  }
  host.print(previewSlug(ref));
  return EXIT.ok;
}

export function expired(host: DeployHost): ExitCode {
  const parsed = parseJson(host.stdin());
  const namespaces = parsed.ok ? Namespaces.safeParse(parsed.value) : undefined;
  if (!namespaces?.success) {
    host.print('expired-previews reads `kubectl get ns -l vp.dev/preview=true -o json` on stdin');
    return EXIT.usage;
  }
  const names = expiredPreviews(
    namespaces.data.items.map((item) => ({
      name: item.metadata.name,
      expiresAt: item.metadata.annotations?.['vp.dev/expires-at'],
    })),
    host.now()
  );
  if (names.length > 0) host.print(names.join('\n'));
  return EXIT.ok;
}
