import { execFile, spawn } from 'node:child_process';
import { run } from './cli';

const docker = {
  show: (args: readonly string[]) =>
    new Promise<number>((resolve) => {
      spawn('docker', args, { stdio: ['ignore', 'inherit', 'inherit'] })
        .on('error', () => resolve(127))
        .on('close', (code) => resolve(code ?? 1));
    }),
  capture: (args: readonly string[]) =>
    new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      execFile('docker', args, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 127;
        resolve({ code, stdout, stderr: stderr || (error?.message ?? '') });
      });
    }),
};

process.exitCode = await run(process.argv.slice(2), {
  docker,
  print: (text) => process.stdout.write(`${text}\n`),
});
