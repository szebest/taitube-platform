import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

export interface S3ConnectionConfig {
  endpoint: string;
  region: string;
  accessKeyId?: string | undefined;
  secretAccessKey?: string | undefined;
  forcePathStyle?: boolean;
}

function localEndpoint(endpoint: string): boolean {
  return (
    endpoint.includes('localhost') || endpoint.includes('127.0.0.1') || endpoint.includes('minio')
  );
}

/** Without both keys the SDK resolves credentials itself, as an IAM role or a profile expects. */
export function s3ClientFrom(config: S3ConnectionConfig): S3Client {
  const { endpoint, region, accessKeyId, secretAccessKey } = config;

  const s3Config: S3ClientConfig = {
    endpoint,
    region,
    forcePathStyle: config.forcePathStyle ?? localEndpoint(endpoint),
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
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
