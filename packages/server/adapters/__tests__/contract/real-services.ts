export interface RealServices {
  readonly databaseUrl: string;
  readonly redis: { readonly url: string; readonly password: string | undefined };
  readonly s3: {
    readonly endpoint: string;
    readonly region: string;
    readonly forcePathStyle: boolean;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly bucket: string;
  };
}

let services: RealServices | undefined;
let claims = 0;

/** Called by the integration run's setup file; a unit or `bun test` run never calls it. */
export function useRealServices(real: RealServices): void {
  services = real;
}

/** The services a subject should connect to, or `undefined` when it should stand in locally. */
export function claimRealServices(): RealServices | undefined {
  if (services) claims += 1;
  return services;
}

export function realServiceClaims(): number {
  return claims;
}
