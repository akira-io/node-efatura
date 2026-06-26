# Validation And Zod

The core layer contains contracts only. Zod is used outside `core`, in domain value-object schemas and presentation request schemas.

## Domain Schemas

The package exports Zod schemas for reusable fiscal value-object validation:

- `partyDataSchema`
- `taxDataSchema`
- `lineItemDataSchema`
- `totalsDataSchema`

The parsing functions keep the public error contract stable by converting schema failures into `EfaturaValidationError`.

```ts
import { partyDataSchema, partyDataFrom } from '@akira-io/efatura';

const parsed = partyDataSchema.parse({
  nif: '100200300',
  name: 'Emitter',
});

const party = partyDataFrom(parsed);
```

## Presentation Schemas

HTTP adapters use shared Zod schemas before calling the facade:

- `dfeXmlRequestSchema`
- `dfeZipFileSchema`
- `dfeZipRequestSchema`

Adapters reject malformed payloads with `EfaturaValidationError` and do not place HTTP-specific validation in the domain or core layers.

## Boundary Rule

`src/core` must stay framework-free and schema-library-free. Contracts can mention TypeScript types, but concrete validation belongs in `domain`, `application`, or `presentation`.
