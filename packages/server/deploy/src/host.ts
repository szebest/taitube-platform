import type { KeyDocs } from './required-keys';

export interface DeployHost {
  root: string;
  docs: KeyDocs;
  isLocalCredential: (value: string) => boolean;
  now: () => Date;
  readText: (path: string) => string | undefined;
  writeText: (path: string, text: string) => void;
  git: (args: readonly string[]) => string | undefined;
  stdin: () => string;
  print: (text: string) => void;
}
