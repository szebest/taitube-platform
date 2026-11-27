import { token } from '@kit/di';

export interface Clock {
  now(): number;
}

export interface Random {
  next(): number;
}

export interface EnvSource {
  get(key: string): string | undefined;
}

export type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface CookieJar {
  get(name: string): Promise<string | undefined>;
}

export const Clock = token<Clock>('Clock');
export const Random = token<Random>('Random');
export const EnvSource = token<EnvSource>('EnvSource');
export const Fetch = token<Fetch>('Fetch');
export const CookieJar = token<CookieJar>('CookieJar');
