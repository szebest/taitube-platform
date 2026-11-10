import { type DemoHost } from './host';
import { helpText, parseDemoCommand } from './options';
import {
  EXIT,
  type SeedFn,
  runDown,
  runLogin,
  runReset,
  runSeed,
  runStatus,
  runUp,
} from './orchestrate';

export async function run(argv: readonly string[], host: DemoHost, seed: SeedFn): Promise<number> {
  const command = parseDemoCommand(argv, host.env);
  if (!command.ok) {
    host.print(`${command.error}. See pnpm demo --help.`);
    return EXIT.usage;
  }
  const parsed = command.value;
  switch (parsed.kind) {
    case 'help':
      host.print(helpText());
      return EXIT.ok;
    case 'up':
      return runUp(host, parsed.options, seed);
    case 'seed':
      return runSeed(host, parsed.options, seed);
    case 'reset':
      return runReset(host, parsed.options, seed);
    case 'down':
      return runDown(host, parsed.options);
    case 'status':
      return runStatus(host, parsed.options);
    case 'login':
      return runLogin(host, parsed.options, parsed.persona);
  }
}
