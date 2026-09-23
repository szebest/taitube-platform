import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

export interface S3ConnectionConfig {
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

function localEndpoint(endpoint: string): boolean {
  return (
    endpoint.includes('localhost') || endpoint.includes('127.0.0.1') || endpoint.includes('minio')
  );
}

export function s3ClientFrom(config: S3ConnectionConfig): S3Client {
  const endpoint =
    config.endpoint ??
    process.env['S3_ENDPOINT'] ??
    process.env['STORAGE_ENDPOINT'] ??
    'http://localhost:9000';

  const s3Config: S3ClientConfig = {
    endpoint,
    region:
      config.region ?? process.env['S3_REGION'] ?? process.env['STORAGE_REGION'] ?? 'us-east-1',
    credentials: {
      accessKeyId:
        config.accessKeyId ??
        process.env['S3_ACCESS_KEY_ID'] ??
        process.env['STORAGE_ACCESS_KEY_ID'] ??
        'minioadmin',
      secretAccessKey:
        config.secretAccessKey ??
        process.env['S3_SECRET_ACCESS_KEY'] ??
        process.env['STORAGE_SECRET_ACCESS_KEY'] ??
        'minioadmin',
    },
    forcePathStyle:
      config.forcePathStyle ??
      (process.env['S3_FORCE_PATH_STYLE'] === 'true' ||
        process.env['STORAGE_FORCE_PATH_STYLE'] === 'true' ||
        localEndpoint(endpoint)),
  };

  return new S3Client(s3Config);
}

/**
 * AWS SDK v3 generates a service-exception class per command, so `instanceof` is unreliable across
 * sub-package versions; `name` is what the SDK documents for discriminating them.
 */
export function isNotFound(cause: unknown): boolean {
  const error = cause as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    error.name === 'NotFound' ||
    error.name === 'NoSuchKey' ||
    error.$metadata?.httpStatusCode === 404
  );
}
