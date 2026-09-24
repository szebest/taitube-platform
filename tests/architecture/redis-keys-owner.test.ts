import ts from 'typescript';
import { productionSources, read } from './repo-files';

const OWNERS = ['packages/server/events/src/keys.ts', 'packages/server/events/src/channels.ts'];

const TEMPLATE_PREFIX = /^(taitube|video|user):/;
const STRING_PREFIX = /^taitube:/;

function handBuiltKeys(name: string, source: string): string[] {
  if (!/(taitube|video|user):/.test(source)) return [];
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isNoSubstitutionTemplateLiteral(node) && TEMPLATE_PREFIX.test(node.text)) {
      found.push(node.getText(file));
    } else if (ts.isTemplateExpression(node) && TEMPLATE_PREFIX.test(node.head.text)) {
      found.push(node.getText(file));
    } else if (ts.isStringLiteral(node) && STRING_PREFIX.test(node.text)) {
      found.push(node.getText(file));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('architecture: one owner per Redis key family', () => {
  it.each([
    ['a cache key template', 'const key = `taitube:user:${userId}:reactions`;'],
    ['a channel template', 'const channel = `video:${videoId}`;'],
    ['a user channel template', 'const channel = `user:${userId}`;'],
    ['a constant cache key', "export const KEY = 'taitube:cache:categories:v1';"],
    ['a wildcard template', 'const all = `video:*`;'],
  ])('fires on %s', (_name, source) => {
    expect(handBuiltKeys('fixture.ts', source)).not.toEqual([]);
  });

  it('passes a permission action, which shares the prefix and is no Redis key', () => {
    expect(handBuiltKeys('fixture.ts', "const action = 'video:read';")).toEqual([]);
  });

  it('finds no Redis key or channel built outside @vp/events', () => {
    const sources = productionSources();
    const offenders = sources
      .filter((file) => !OWNERS.includes(file))
      .flatMap((file) => handBuiltKeys(file, read(file)).map((key) => `${file}: ${key}`));

    expect(sources).toEqual(expect.arrayContaining(OWNERS));
    expect(offenders).toEqual([]);
  });
});
