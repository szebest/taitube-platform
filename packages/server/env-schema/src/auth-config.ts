import type { JWS_ALGORITHMS } from './app-env';

type JwsAlgorithm = (typeof JWS_ALGORITHMS)[number];

export type AuthConfig =
  | {
      type: 'jwks';
      jwksUrl: string;
      issuer: string;
      audience: string;
      algorithms: readonly JwsAlgorithm[];
      cacheTtlMs: number;
      refetchIntervalMs: number;
      fetchTimeoutMs: number;
    }
  | {
      type: 'dev';
      issuer: string;
      audience: string;
      adminToken: string | undefined;
      adminUserId: string;
    };
