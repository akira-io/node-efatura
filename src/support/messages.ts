export const messages = {
  validation: {
    invoiceTypeMismatch: 'Invoice type does not match the expected document type.',
    partyNifRequired: 'Party NIF is required.',
    partyNameRequired: 'Party name is required.',
    receiverRequired: 'Receiver is required.',
    emitterRequired: 'Emitter is required.',
    totalsRequired: 'Totals are required.',
    invoiceRequired: 'Invoice is required.',
    linesRequired: 'At least one line item is required.',
    totalsNegative: 'Totals cannot be negative.',
    payableAlternativeCurrencyUnsupported:
      'Payable alternative amount currency code is unsupported. Use a canonical uppercase code from the active e-Fatura schema.',
    naTaxExemptionRequired: 'NA tax requires an exemption reason.',
  },
  invoice: {
    issueDateRequired: 'Issue date is required.',
    receiverRequiredForType: 'Receiver is required for this document type.',
    originalIudRequired: 'Original IUD is required for credit notes.',
    creditNoteReasonRequired: 'Credit note reason is required.',
    documentTypeNotSupported: (type: string): string =>
      `Document type ${type} is recognized but not supported for emission.`,
  },
  config: {
    transmitterNifRequired: 'Transmitter NIF is required.',
    transmitterLedRequired: 'Transmitter LED code is required.',
    softwareCodeRequired: 'Software code is required.',
    softwareNameRequired: 'Software name is required.',
    softwareVersionRequired: 'Software version is required.',
    middlewareBaseUrlRequired: 'Middleware base URL is required.',
    environmentInvalid: 'Repository environment is invalid.',
  },
} as const;
