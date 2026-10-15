import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [dir] = process.argv.slice(2);

if (!dir) {
  process.stderr.write('usage: import-bundle <dir>\n');
  process.exit(2);
}

const modules = readdirSync(dir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file, url: pathToFileURL(join(dir, file)).href }));

// Plain Node in a child: this script runs under tsx, whose loader would transform the bundle first.
// The verdict is the child's last line, since a module may print while it loads.
const importEach = `
const failures = [];
for (const { file, url } of ${JSON.stringify(modules)}) {
  try {
    await import(url);
  } catch (error) {
    failures.push(file + ': ' + String(error?.message ?? error).split('\\n')[0]);
  }
}
process.stdout.write('\\n' + JSON.stringify(failures));
`;
const run = spawnSync(process.execPath, ['--input-type=module', '--eval', importEach], {
  encoding: 'utf8',
  env: { PATH: process.env.PATH },
});
const lastLine = run.stdout.trim().split('\n').at(-1) ?? '';
const failures: string[] = run.status === 0 ? JSON.parse(lastLine) : [run.stderr.trim()];

if (failures.length > 0) {
  process.stderr.write(`${failures.length} of ${modules.length} modules in ${dir} do not load:\n`);
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`${modules.length} modules in ${dir} load\n`);
