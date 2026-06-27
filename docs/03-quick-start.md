# Quick Start

```ts
import { DocumentType, TaxTypeCode, createEfatura } from '@akira-io/efatura';

const efatura = createEfatura({
  transmitterNif: '100200300',
  transmitterLed: '123',
  emitter: {
    name: 'Emitter',
    address: {
      countryCode: 'CV',
      addressDetail: 'Emitter address',
    },
    contacts: {
      email: 'issuer@example.cv',
      telephone: '5551234',
    },
  },
  softwareCode: 'SW001',
  softwareName: 'Efatura Suite',
  softwareVersion: '1.0.0',
  middlewareBaseUrl: 'https://middleware.example',
  dfaBaseUrl: 'https://pe.efatura.cv/dfe/view',
  environment: 'TEST',
});

const invoice = efatura
  .invoice()
  .type(DocumentType.ElectronicInvoice)
  .issueDate('2026-02-08')
  .receiver({ taxId: { countryCode: 'CV', value: '900800700' }, name: 'Receiver' })
  .line({
    quantity: { value: 1, unitCode: 'EA' },
    price: 1000,
    priceExtension: 1000,
    netTotal: 1000,
    taxes: [{ taxTypeCode: TaxTypeCode.IVA, taxPercentage: 15, taxTotal: 150 }],
    item: {
      description: 'Item',
      emitterIdentification: 'ITEM1',
    },
  })
  .totals({
    priceExtensionTotalAmount: 1000,
    netTotalAmount: 1000,
    taxTotalAmount: 150,
    payableAmount: 1150,
  })
  .validate();
```

`invoice.id` is generated as a UUID when no id is provided.

`emitter` in `createEfatura` is the default issuer. Call `.emitter(...)` on an invoice only when that document must be issued by another taxpayer.
