import { dirname, posix } from 'node:path';
import {
  type MarkdownDocument,
  markdownDocument,
  parseMarkdown,
  trackedDocuments,
} from './markdown';
import { trackedPaths } from './repo-files';

interface Repo {
  exists: (path: string) => boolean;
  document: (path: string) => MarkdownDocument;
}

type Target =
  | { type: 'external' }
  | { type: 'anchor'; anchor: string }
  | { type: 'path'; path: string; anchor: string };

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function targetOf(file: string, url: string): Target {
  if (URL_SCHEME.test(url)) return { type: 'external' };

  const hashAt = url.indexOf('#');
  const pathPart = hashAt === -1 ? url : url.slice(0, hashAt);
  const anchor = hashAt === -1 ? '' : decodeURIComponent(url.slice(hashAt + 1));
  if (pathPart === '') return { type: 'anchor', anchor };

  const decoded = decodeURIComponent(pathPart);
  const joined = decoded.startsWith('/') ? decoded.slice(1) : posix.join(dirname(file), decoded);
  const path = posix.normalize(joined).replace(/\/$/, '');
  return { type: 'path', path, anchor };
}

function missingAnchor(document: MarkdownDocument, anchor: string): boolean {
  return anchor !== '' && !document.anchors.has(anchor);
}

function assertNever(value: never): never {
  throw new Error(`unhandled link target ${JSON.stringify(value)}`);
}

/** Every link in `file` naming a path or a heading the repo does not have, as `line: url (why)`. */
function brokenLinks(file: string, repo: Repo): string[] {
  const broken: string[] = [];
  for (const { url, line } of repo.document(file).links) {
    const target = targetOf(file, url);
    switch (target.type) {
      case 'external':
        break;
      case 'anchor':
        if (missingAnchor(repo.document(file), target.anchor)) {
          broken.push(`${file}:${line}: ${url} (no such heading)`);
        }
        break;
      case 'path':
        if (!repo.exists(target.path)) {
          broken.push(`${file}:${line}: ${url} (no such file)`);
        } else if (
          target.path.endsWith('.md') &&
          missingAnchor(repo.document(target.path), target.anchor)
        ) {
          broken.push(`${file}:${line}: ${url} (no such heading in ${target.path})`);
        }
        break;
      default:
        assertNever(target);
    }
  }
  return broken;
}

function fixtureRepo(documents: Record<string, string>): Repo {
  return {
    exists: (path) => path in documents || path === 'docs',
    document: (path) => parseMarkdown(documents[path] ?? ''),
  };
}

const FIXTURE = {
  'docs/SDD.md': [
    '# SDD',
    '## ADR-24 — Result-typed errors',
    '## 5. Domain Model & Database Schema',
    '## Notes',
    '## Notes',
    '```sh',
    '# not a heading',
    '```',
  ].join('\n'),
  'docs/guide.md': [
    '[em dash](SDD.md#adr-24--result-typed-errors)',
    '[ampersand](./SDD.md#5-domain-model--database-schema)',
    '[repeat](SDD.md#notes-1)',
    '[directory](../docs)',
    '[external](https://example.com/missing#nowhere)',
    '[single hyphen](SDD.md#adr-24-result-typed-errors)',
    '[code block](SDD.md#not-a-heading)',
    '[missing file](missing.md)',
    '[own heading](#guide)',
  ].join('\n'),
};

describe('architecture: doc-links', () => {
  it('resolves files, directories and GitHub anchors, and fires on the rest', () => {
    expect(brokenLinks('docs/guide.md', fixtureRepo(FIXTURE))).toEqual([
      'docs/guide.md:6: SDD.md#adr-24-result-typed-errors (no such heading in docs/SDD.md)',
      'docs/guide.md:7: SDD.md#not-a-heading (no such heading in docs/SDD.md)',
      'docs/guide.md:8: missing.md (no such file)',
      'docs/guide.md:9: #guide (no such heading)',
    ]);
  });

  it('reads every tracked document outside .agents, each once', () => {
    const documents = trackedDocuments();

    expect(documents).toContain('docs/SDD.md');
    expect(documents).toContain('packages/server/logger/AGENTS.md');
    expect(documents.filter((file) => file.startsWith('.agents/'))).toEqual([]);
    expect(documents.filter((file) => file.endsWith('CLAUDE.md'))).toEqual([]);
  });

  it('finds no broken relative link or anchor in any tracked document', () => {
    const paths = trackedPaths();
    const repo: Repo = {
      exists: (path) => path === '.' || path === '' || paths.has(path),
      document: markdownDocument,
    };

    expect(trackedDocuments().flatMap((file) => brokenLinks(file, repo))).toEqual([]);
  });
});
