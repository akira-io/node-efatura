# Packaging

DFE transmission uses ZIP files containing compact XML documents. The implementation lives in `src/application/packaging` because packaging is an application use case, not a core contract and not a presentation adapter.

## Files

```text
src/application/packaging/
  crc32.ts      CRC32 calculation for ZIP records
  dfe-zip.ts    Deflate ZIP writer for DFE XML files
```

## ZIP Rules

`buildDfeZip()` accepts a list of DFE XML files:

```ts
const zip = efatura.buildDfeZip([
  { iud, xml },
]);
```

Each XML file is written into the archive as `{IUD}.xml`, using Deflate compression. The helper validates IUDs before writing filenames.

## Transport Split

Packaging is separate from transport:

- `buildDfeZip()` only creates the ZIP payload.
- `MiddlewareTransport` submits ZIP payloads to a local middleware instance.
- `PlatformTransport` submits ZIP payloads to the official PE API using OAuth bearer tokens and repository headers.

This split keeps packaging deterministic and easy to test with golden vectors.
