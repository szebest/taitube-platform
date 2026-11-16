import { violations } from './keyset-timestamps-rules';
import { productionSources, read } from './repo-files';

const POSTGRES = 'packages/server/adapters/postgres/';

const PREAMBLE = [
  "import * as schema from '@vp/db';",
  "import { comments } from '@vp/db';",
  'const { videos: v } = schema;',
].join('\n');

function ruleNames(body: string): string[] {
  return violations('fixture.ts', `${PREAMBLE}\n${body}`).map((hit) => hit.split(': ')[1] ?? '');
}

describe('architecture: keyset walks page on millisecond timestamps', () => {
  it.each([
    { shape: 'a destructured table column', body: 'keysetBefore(v.createdAt, v.id, cursor);' },
    {
      shape: 'a namespaced table column',
      body: "keysetPast(schema.playlists.updatedAt, schema.playlists.id, cursor, 'asc');",
    },
    {
      shape: 'a table imported by name',
      body: 'keysetBefore(comments.createdAt, comments.id, cursor);',
    },
    {
      shape: 'a const that names the column',
      body: 'const key = v.createdAt;\nkeysetBefore(key, v.id, cursor);',
    },
    {
      shape: 'a local function that returns the column',
      body: "function sortKey(sort) {\n  if (sort === 'newest') return v.createdAt;\n  return v.title;\n}\nkeysetPast(sortKey(sort), v.id, cursor, order);",
    },
    {
      shape: 'a rank built over the column',
      body: 'const INPUT = { createdAt: sql`${v.createdAt}` };\nconst rank = (input) => input.createdAt;\nkeysetBefore(rank(INPUT), v.id, cursor);',
    },
  ])('fires on a sort key read from $shape', ({ body }) => {
    expect(ruleNames(body)).toEqual(['pages on a raw timestamp']);
  });

  it.each([
    {
      shape: 'in the same query',
      body: 'db.select().from(v).where(keysetBefore(msTimestamp(v.createdAt), v.id, cursor)).orderBy(desc(v.createdAt), desc(v.id));',
    },
    {
      shape: 'through a named where clause',
      body: 'const where = keysetBefore(msTimestamp(v.createdAt), v.id, cursor);\ndb.select().from(v).where(where).orderBy(desc(v.createdAt));',
    },
  ])('fires on an orderBy beside a keyset $shape', ({ body }) => {
    expect(ruleNames(body)).toEqual(['orders a keyset walk on a raw timestamp']);
  });

  it.each([
    {
      shape: 'a row value beside a null test',
      body: [
        'const isOpen = sql`(${v.deletedAt} IS NULL)`;',
        'function after(cursor) {',
        '  const { open, createdAt, id } = cursor;',
        '  return sql`(${isOpen}, ${v.createdAt}, ${v.id}) < (${open}::boolean, ${createdAt.toISOString()}::timestamptz, ${id}::uuid)`;',
        '}',
      ].join('\n'),
    },
    {
      shape: 'one timestamp',
      body: 'const after = (cursor) => sql`${v.updatedAt} >= ${cursor.updatedAt}`;',
    },
    {
      shape: 'sort keys handed to a local row comparison',
      body: [
        'const CREATED = { column: v.createdAt, at: (k) => sql`${k.createdAt.toISOString()}::timestamptz` };',
        'function rowCompare(keys, op, cursor) {',
        '  const columns = sql.join(keys.map((key) => key.column), sql`, `);',
        '  const values = sql.join(keys.map((key) => key.at(cursor)), sql`, `);',
        '  return sql`(${columns}) ${sql.raw(op)} (${values})`;',
        '}',
        "const after = (cursor) => rowCompare([CREATED], '<', cursor);",
      ].join('\n'),
    },
  ])('fires on a hand-written cursor comparison of $shape', ({ body }) => {
    expect(ruleNames(body)).toEqual(['compares a raw timestamp to a cursor']);
  });

  it('fires on an orderBy beside a hand-written cursor comparison', () => {
    const body = [
      'const after = (cursor) => sql`(${msTimestamp(v.createdAt)}, ${v.id}) < (${cursor.createdAt}, ${cursor.id})`;',
      'db.select().from(v).where(after(cursor)).orderBy(desc(v.createdAt), desc(v.id));',
    ].join('\n');

    expect(ruleNames(body)).toEqual(['orders a keyset walk on a raw timestamp']);
  });

  it.each([
    {
      shape: 'a truncated hand-written comparison and order',
      body: [
        'const at = msTimestamp(v.createdAt);',
        'const after = (cursor) => sql`(${at}, ${v.id}) < (${cursor.createdAt}, ${cursor.id})`;',
        'db.select().from(v).where(after(cursor)).orderBy(desc(at), desc(v.id));',
      ].join('\n'),
    },
    {
      shape: 'a cutoff from the clock',
      body: 'db.select().from(v).where(sql`COALESCE(${v.publishedAt}, ${v.updatedAt}) < ${cutoff.toISOString()}::timestamptz`).orderBy(asc(v.updatedAt));',
    },
    {
      shape: 'a row compared with another row',
      body: 'const answered = sql`(answer.created_at, answer.id) > (${v.createdAt}, ${v.id})`;',
    },
    {
      shape: 'a truncated timestamp in the scope and the order',
      body: 'db.select().from(v).where(keysetBefore(msTimestamp(v.createdAt), v.id, cursor)).orderBy(desc(msTimestamp(v.createdAt)), desc(v.id));',
    },
    {
      shape: 'a const that truncates',
      body: 'const at = msTimestamp(v.createdAt);\ndb.select().from(v).where(keysetBefore(at, v.id, cursor)).orderBy(desc(at), desc(v.id));',
    },
    { shape: 'a counter column', body: 'keysetBefore(v.viewsCount, v.id, cursor);' },
    {
      shape: 'a rank handed in as a parameter',
      body: 'const page = (rank) => keysetBefore(rank, v.id, cursor);',
    },
    {
      shape: 'a field of a value that is no table',
      body: 'keysetBefore(input.createdAt, v.id, cursor);',
    },
    {
      shape: 'an orderBy with no keyset beside it',
      body: 'db.select().from(v).orderBy(asc(v.createdAt), asc(v.id));',
    },
  ])('lets $shape through', ({ body }) => {
    expect(ruleNames(body)).toEqual([]);
  });

  it('holds every Postgres adapter source', () => {
    const files = productionSources().filter((file) => file.startsWith(POSTGRES));

    expect(files.length).toBeGreaterThan(50);
    expect(files.flatMap((file) => violations(file, read(file)))).toEqual([]);
  });
});
