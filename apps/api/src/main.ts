import { buildApp } from './app.js';

export async function main(): Promise<void> {
  const app = buildApp();
  console.log(`[${app.name}] Starting in ${process.env['NODE_ENV'] ?? 'development'} mode...`);
}

if (process.env['NODE_ENV'] !== 'test') {
  main().catch((err) => {
    console.error('Fatal API error:', err);
    process.exit(1);
  });
}
