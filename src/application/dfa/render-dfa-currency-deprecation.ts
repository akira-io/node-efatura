const warningStateKey = Symbol.for('@akira-io/efatura/render-dfa-currency-deprecation');

export function warnRenderDfaCurrencyDeprecation(currency: string | undefined): void {
  if (
    currency === undefined ||
    Object.getOwnPropertyDescriptor(globalThis, warningStateKey) !== undefined
  ) {
    return;
  }

  Object.defineProperty(globalThis, warningStateKey, {
    configurable: true,
    value: true,
  });
  process.emitWarning(
    'RenderDfaOptions.currency is deprecated and will be removed in v1.0.0. Use prepareInvoiceToCve() and pass invoice with conversion metadata.',
    {
      type: 'DeprecationWarning',
      code: 'EFATURA_RENDER_DFA_CURRENCY_DEPRECATED',
    },
  );
}
