# Quick Start

```ts
import { DocumentType, createEfatura } from '@akira-io/efatura';

const efatura = createEfatura({
  transmitterNif: '100200300',
  transmitterLed: 'LED123',
  softwareCode: 'SW-001',
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
  .emitter({ nif: '100200300', name: 'Emitter' })
  .receiver({ nif: '900800700', name: 'Receiver' })
  .line({
    description: 'Item',
    quantity: 1,
    unitPrice: 1000,
    total: 1000,
    taxes: [{ type: 'IVA', rate: 15, amount: 150 }],
  })
  .totals({ subtotal: 1000, taxTotal: 150, grandTotal: 1150 })
  .validate();
```

`invoice.id` is generated as a UUID when no id is provided.
