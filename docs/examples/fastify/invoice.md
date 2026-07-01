# Fastify Invoice Payload

Use this invoice factory from the Fastify, React, Vue, and Svelte examples. It keeps browser examples focused on adapter calls while the fiscal payload stays in one place.

```ts
export function createInvoice(): Record<string, unknown> {
  const lines = [
    line('SERV-SETUP', 'Servico de configuracao e-Fatura', 1, 15000),
    line('SERV-API', 'Integracao API de faturacao', 1, 8500),
    line('SERV-DFA', 'Ajuste de layout DFA', 2, 6250),
    line('SERV-VALID', 'Validacao fiscal automatizada', 3, 2750),
    line('SERV-TRAIN', 'Sessao tecnica de operacao', 1, 12000),
    line('SERV-SIGN', 'Configuracao de assinatura XML', 1, 9500),
    line('SERV-QA', 'Teste de regressao fiscal', 4, 1800),
    line('SERV-SUPPORT', 'Acompanhamento de arranque', 2, 3200),
  ];
  const subtotal = lines.reduce((total, item) => total + Number(item.netTotal), 0);
  const taxTotal = lines.reduce((total, item) => {
    const taxes = Array.isArray(item.taxes) ? item.taxes : [];

    return total + taxes.reduce((lineTotal, tax) => lineTotal + Number(tax.taxTotal), 0);
  }, 0);

  return {
    type: 'FTE',
    issueDate: '2026-02-08',
    issueTime: '10:30:00',
    serie: '123',
    innerDocumentNumber: '1',
    emitter: {
      taxId: { countryCode: 'CV', value: '100200300' },
      name: 'Playground Emitter',
      address: {
        countryCode: 'CV',
        addressDetail: 'Rua do Emissor, Praia',
      },
      contacts: {
        email: 'issuer@example.cv',
        telephone: '5551234',
      },
    },
    receiver: {
      taxId: { countryCode: 'CV', value: '900800700' },
      name: 'Playground Receiver',
      address: {
        countryCode: 'CV',
        addressDetail: 'Rua do Cliente, Praia',
      },
      contacts: {
        email: 'receiver@example.cv',
        telephone: '5554321',
      },
    },
    lines,
    totals: {
      priceExtensionTotalAmount: subtotal,
      chargeTotalAmount: 0,
      discountTotalAmount: 0,
      netTotalAmount: subtotal,
      taxTotalAmount: taxTotal,
      payableAmount: subtotal + taxTotal,
    },
  };
}

function line(
  code: string,
  description: string,
  quantity: number,
  unitPrice: number,
): Record<string, unknown> {
  const subtotal = quantity * unitPrice;
  const taxTotal = subtotal * 0.15;

  return {
    lineTypeCode: 'N',
    quantity: {
      value: quantity,
      unitCode: 'UN',
    },
    price: unitPrice,
    priceExtension: subtotal,
    netTotal: subtotal,
    taxes: [
      {
        taxTypeCode: 'IVA',
        taxPercentage: 15,
        taxTotal,
      },
    ],
    item: {
      description,
      emitterIdentification: code,
    },
  };
}
```

The eight lines are intentional. They make DFA pagination and table layout easier to test than a one-line invoice.
