import { readQuarantine, vitestExclude } from './quarantine/entries';

/** Prints the `--exclude` flags that keep the quarantined specs out of `pnpm test:unit` in CI. */
function main(): void {
  const flags = readQuarantine().map(({ spec }) => `--exclude=${vitestExclude(spec)}`);
  process.stdout.write(flags.join(' '));
}

if (import.meta.main) main();
