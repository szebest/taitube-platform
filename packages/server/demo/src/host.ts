export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface DemoHost {
  cwd: string;
  env: Readonly<Record<string, string | undefined>>;
  platform: NodeJS.Platform;
  nodeVersion: string;
  tty: boolean;
  now: () => number;
  print: (line: string) => void;
  /** Streams the command's output to the terminal and answers its exit code. */
  show: (command: string, args: readonly string[]) => Promise<number>;
  capture: (command: string, args: readonly string[]) => Promise<ExecResult>;
  fileExists: (path: string) => boolean;
  readFile: (path: string) => string | undefined;
  /** Creates the missing directories above the file. */
  writeFile: (path: string, text: string) => void;
  removePath: (path: string) => void;
  /** True when the URL answers 2xx. */
  httpOk: (url: string) => Promise<boolean>;
}

export interface Command {
  command: string;
  args: readonly string[];
}
