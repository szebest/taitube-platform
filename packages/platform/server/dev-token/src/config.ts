export interface DevTokenConfig {
  readonly product: string;
  readonly issuer: string;
  readonly audience: string;
  readonly keyId: string;
  readonly seed: string;
  readonly routes: {
    readonly jwks: readonly string[];
    readonly token: string;
  };
  /** Milliseconds since the epoch: a token's `iat` is stamped and its `exp` checked against it. */
  readonly now: () => number;
}
