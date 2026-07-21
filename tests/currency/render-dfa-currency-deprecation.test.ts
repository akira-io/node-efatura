import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dfaRenderInputFrom } from '../../src/application/dfa/dfa-render-input';

const iud = 'CV3260208100200300001230100000000112345678909';
const qrCodeUrl = 'https://pe.efatura.cv/dfe/view/example';
const warningStateKey = Symbol.for('@akira-io/efatura/render-dfa-currency-deprecation');
const warningMessage =
  'RenderDfaOptions.currency is deprecated and will be removed in v1.0.0. Use prepareInvoiceToCve() and pass invoice with conversion metadata.';

describe('RenderDfaOptions.currency deprecation', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, warningStateKey);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, warningStateKey);
  });

  it('emits the stable Node.js deprecation warning when currency is defined', () => {
    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);

    dfaRenderInputFrom({ iud, currency: 'CVE' }, qrCodeUrl);

    expect(emitWarning).toHaveBeenCalledOnce();
    expect(emitWarning).toHaveBeenCalledWith(warningMessage, {
      type: 'DeprecationWarning',
      code: 'EFATURA_RENDER_DFA_CURRENCY_DEPRECATED',
    });
  });

  it('emits the warning once per process across repeated calls', () => {
    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);

    dfaRenderInputFrom({ iud, currency: 'CVE' }, qrCodeUrl);
    dfaRenderInputFrom({ iud, currency: ' cve ' }, qrCodeUrl);

    expect(emitWarning).toHaveBeenCalledOnce();
  });

  it('does not emit a warning when currency is omitted', () => {
    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);

    dfaRenderInputFrom({ iud }, qrCodeUrl);

    expect(emitWarning).not.toHaveBeenCalled();
  });

  it('warns before preserving legacy foreign-currency validation', () => {
    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);

    expect(() => dfaRenderInputFrom({ iud, currency: 'EUR' }, qrCodeUrl)).toThrowError(
      expect.objectContaining({ field: 'currency', code: 'dfa.currency_invalid' }),
    );
    expect(emitWarning).toHaveBeenCalledOnce();
  });
});
