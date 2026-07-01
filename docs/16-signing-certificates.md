# Signing And Certificates

The package separates XML generation from signing. Build and validate XML first, then sign with a configured signer.

## Signing DFE XML

```ts
const signed = await efatura.signDfeXml(xml, {
  certificate: process.env.EFATURA_CERTIFICATE_PEM,
  privateKey: process.env.EFATURA_PRIVATE_KEY_PEM,
  signingTime: '2026-02-08T11:30:00.000Z',
});
```

The default `XadesBesSigner` signs with RSA-SHA256 and returns:

```ts
{
  xml: string,
  algorithm: 'RSA-SHA256',
  profile: 'XAdES-BES'
}
```

`certificate` and `privateKey` are required unless the application injects a signer that obtains key material elsewhere.

## Signing Event XML

```ts
const signedEvent = await efatura.signEventXml(eventXml, {
  certificate,
  privateKey,
});
```

Event XML uses the same signer contract as DFE XML.

## Certificate Validation

```ts
const result = await efatura.validateCertificate({
  certificate,
  privateKey,
  caCertificates: [caCertificate],
});

if (!result.valid) {
  console.error(result.issues);
}
```

The default OpenSSL validator checks:

- certificate material can be parsed;
- private key matches the certificate;
- CA validation when `caCertificates` are supplied.

The method returns structured issues such as `certificate.invalid` and `certificate.private_key_mismatch`.

## Operational Guidance

- Keep certificates and private keys on the server.
- Do not expose signing material to browser clients or mobile apps.
- Load secrets from the deployment secret store, not from committed files.
- Validate certificate and private key material before release or rotation.
- Record signing failures with enough metadata to identify the document, but never log private keys.

## Testing

Unit tests create temporary certificates and verify that signed XML contains XAdES signed properties, valid signed references, and XSD-valid DFE XML.

OpenSSL-based certificate tests are skipped when OpenSSL is unavailable on the local machine.
