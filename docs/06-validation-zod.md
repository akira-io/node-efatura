# Validation And Zod

The core layer contains contracts only. Zod is used outside `core`, in domain value-object schemas and presentation request schemas.

## Domain Schemas

The package exports Zod schemas for reusable fiscal value-object validation:

- `partyDataSchema`
- `taxDataSchema`
- `lineItemDataSchema`
- `totalsDataSchema`
- `eventDataSchema`
- `eventDocumentRangeDataSchema`
- `extraFieldDataSchema`
- `extraFieldsDataSchema`

The parsing functions keep the public error contract stable by converting schema failures into `EfaturaValidationError`.

```ts
import { isCapeVerdeNif, partyDataFrom, partyDataSchema } from '@akira-io/efatura';

const parsed = partyDataSchema.parse({
  taxId: { countryCode: 'CV', value: '100200300' },
  name: 'Emitter',
});

const party = partyDataFrom(parsed);
const valid = isCapeVerdeNif('100200300');
```

For `countryCode = CV`, `TaxId.value` must match the official XSD `stTaxIdCV` pattern `[1-9][0-9]{8}`. The package also applies this validation to `transmitterNif` during `createEfatura(config)` resolution. Other country codes keep the generic no-space, 5-to-20-character `TaxId` rule from the official XSD.

## Presentation Schemas

HTTP adapters use shared Zod schemas before calling the facade:

- `dfeXmlRequestSchema`
- `eventXmlRequestSchema`
- `dfeZipFileSchema`
- `dfeZipRequestSchema`

Adapters reject malformed payloads with `EfaturaValidationError` and do not place HTTP-specific validation in the domain or core layers.

## Fiscal Rules

The domain validates the rules that are cheap to catch before XSD validation:

- `ReceiptTypeCode` must be `1`, `2`, `3`, or `4`.
- `ReceiptTypeCode = 4` requires `RentReceipt`.
- `TransportDocumentTypeCode` must be `1` through `5`.
- `TransportDocumentTypeCode = 5` requires `References`.
- Credit, debit, and return notes validate allowed `IssueReasonCode` values per document type.
- `IssueReasonCode = DRP` requires `RappelPeriod`.
- `TaxTypeCode = NA` requires `TaxExemptionReasonCode`.
- Payload fields are rejected when the selected official document type does not allow them in its XSD sequence.

## Boundary Rule

`src/core` must stay framework-free and schema-library-free. Contracts can mention TypeScript types, but concrete validation belongs in `domain`, `application`, or `presentation`.
