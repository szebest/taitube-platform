# Changelog

## 0.4.0

- `./contract` exports `describeErrorCodeSetContract` and `MakeErrorCodeSet`; vitest is a peer.

## 0.3.0

- `InfraErrorCodes` (`DATABASE_UNAVAILABLE`, `CACHE_UNAVAILABLE`, `QUEUE_UNAVAILABLE`, `STORAGE_UNAVAILABLE`), the
  `DatabaseUnavailable`, `CacheUnavailable`, `QueueUnavailable`, `StorageUnavailable` and `InfraFailure` types and the
  `databaseUnavailable`, `cacheUnavailable`, `queueUnavailable`, `storageUnavailable` factories.

## 0.2.0

- `CommonErrorCodes` adds `UNAUTHORIZED` and `FORBIDDEN`, the codes `@kit/permissions`' `assertCan` throws.

## 0.1.0

- First release: the public API recorded in api/errors.api.txt.
