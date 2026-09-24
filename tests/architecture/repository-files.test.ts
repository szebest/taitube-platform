import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { read, trackedFiles } from './repo-files';

const ADAPTERS = 'packages/server/adapters/';
const REPOSITORY_CLASS = /Repository$/;

function exportedClasses(file: string, source: string): string[] {
  return parseSource(file, source)
    .statements.filter(ts.isClassDeclaration)
    .filter((node) => node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
    .map((node) => node.name?.text ?? '');
}

function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Each repository class, where its file breaks the one-class-per-file rule, as `file: why`. */
function misplacedRepositories(sources: ReadonlyArray<{ file: string; source: string }>): string[] {
  const misplaced: string[] = [];
  for (const { file, source } of sources) {
    const classes = exportedClasses(file, source);
    const repositories = classes.filter((name) => REPOSITORY_CLASS.test(name));
    for (const name of repositories) {
      if (!file.includes('/repositories/'))
        misplaced.push(`${file}: ${name} outside repositories/`);
      else if (!file.endsWith(`/${kebab(name)}.ts`))
        misplaced.push(`${file}: ${name} not in ${kebab(name)}.ts`);
    }
    if (repositories.length > 0 && classes.length > 1) {
      misplaced.push(`${file}: ${classes.length} classes beside a repository`);
    }
  }
  return misplaced;
}

describe('architecture: every repository implementation has a file of its own', () => {
  it('fires on a repository outside repositories/, under another name, or sharing its file', () => {
    const planted = [
      { file: `${ADAPTERS}postgres/video.ts`, source: 'export class PostgresVideoRepository {}' },
      {
        file: `${ADAPTERS}in-memory/repositories/in-memory-users.ts`,
        source: 'export class InMemoryUserRepository {}',
      },
      {
        file: `${ADAPTERS}postgres/repositories/postgres-dlq-repository.ts`,
        source: 'export class PostgresDlqRepository {}\nexport class PostgresOutboxRepository {}',
      },
    ];

    expect(misplacedRepositories(planted)).toEqual([
      `${ADAPTERS}postgres/video.ts: PostgresVideoRepository outside repositories/`,
      `${ADAPTERS}in-memory/repositories/in-memory-users.ts: InMemoryUserRepository not in in-memory-user-repository.ts`,
      `${ADAPTERS}postgres/repositories/postgres-dlq-repository.ts: PostgresOutboxRepository not in postgres-outbox-repository.ts`,
      `${ADAPTERS}postgres/repositories/postgres-dlq-repository.ts: 2 classes beside a repository`,
    ]);
  });

  it('finds every repository in the adapters in a file named after it, alone', () => {
    const sources = trackedFiles(':(glob)packages/server/adapters/**/*.ts')
      .filter((file) => !file.includes('__tests__'))
      .map((file) => ({ file, source: read(file) }));

    expect(
      sources.filter(({ source }) => /class \w+Repository\b/.test(source)).length
    ).toBeGreaterThan(20);
    expect(misplacedRepositories(sources)).toEqual([]);
  });
});
