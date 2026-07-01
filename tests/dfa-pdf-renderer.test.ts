import { describe, expect, it } from 'vitest';
import type { DfaLineInput } from '../src/core/contracts';
import { PdfDfaRenderer } from '../src/infrastructure/dfa/pdf-dfa-renderer';

describe('PdfDfaRenderer', () => {
  it('paginates DFA item rows instead of dropping them', async () => {
    const lines = Array.from({ length: 24 }, (_, index): DfaLineInput => {
      const netTotal = 1000 + index * 10;

      return {
        code: `ITEM-${index + 1}`,
        description: `Linha fiscal ${index + 1}`,
        quantity: 1,
        unitCode: 'UN',
        unitPrice: netTotal,
        netTotal,
        taxTotal: netTotal * 0.15,
      };
    });
    const netTotalAmount = lines.reduce((total, line) => total + line.netTotal, 0);
    const taxTotalAmount = lines.reduce((total, line) => total + line.taxTotal, 0);
    const dfa = await new PdfDfaRenderer().render({
      iud: 'CV3260630100200300001230100000000107616263314',
      qrCodeUrl: 'https://pe.efatura.cv/dfe/view/CV3260630100200300001230100000000107616263314',
      documentTypeCode: 1,
      series: '123',
      documentNumber: '1',
      issueDate: '2026-06-30',
      issueTime: '23:37:47',
      issuerTaxId: '100200300',
      issuerName: 'Playground Emitter',
      customerTaxId: '900800700',
      customerName: 'Playground Receiver',
      lines,
      totals: {
        priceExtensionTotalAmount: netTotalAmount,
        chargeTotalAmount: 0,
        discountTotalAmount: 0,
        netTotalAmount,
        taxTotalAmount,
        payableAmount: netTotalAmount + taxTotalAmount,
      },
      currency: 'CVE',
    });
    const pageCount = dfa.buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;

    expect(pageCount).toBeGreaterThan(1);
  });
});
