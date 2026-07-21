import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type {
  CurrencyConversionMetadata,
  DfaLineInput,
  DfaRenderInput,
} from '../src/core/contracts';
import { PdfDfaRenderer } from '../src/infrastructure/dfa/pdf-dfa-renderer';

describe('PdfDfaRenderer', () => {
  it('renders complete conversion evidence after CVE totals', async () => {
    const dfa = await new PdfDfaRenderer().render(renderInput());
    const text = pdfTextPages(dfa.buffer).join('\n');

    expect(text).toContain('22 053,00 CVE');
    expect(text).toContain('200,00 EUR');
    expect(text).toContain('1 EUR = 110,265 CVE');
    expect(text).toContain('21/07/2026');
    expect(text).toContain('Banco de Cabo Verde');
  });

  it.each([
    [110.265, '110,265'],
    [0.59727, '0,59727'],
    [101.7495, '101,7495'],
  ])('renders the rate %s with up to five fractional digits', async (rate, expected) => {
    const dfa = await new PdfDfaRenderer().render(
      renderInput({ conversion: { ...conversion(), rate } }),
    );
    const text = pdfTextPages(dfa.buffer).join('\n');

    expect(text).toContain(`1 EUR = ${expected} CVE`);
  });

  it('wraps a long conversion source URL into multiple PDF text rows', async () => {
    const sourceUrl =
      'https://www.bcv.cv/pt/PoliticaMonetaria/EstatisticasCambiais/Documentos/Taxas-de-cambio-oficiais-2026-07-21?documento=referencia-fiscal-e-fatura';
    const dfa = await new PdfDfaRenderer().render(
      renderInput({ conversion: { ...conversion(), sourceUrl } }),
    );
    const textOperations = pdfTextOperations(dfa.buffer);

    expect(textOperations.join('')).toContain(sourceUrl);
    expect(textOperations).not.toContain(sourceUrl);
  });

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
      ...renderInput(),
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
    });
    const pageCount = dfa.buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
    const pageTexts = pdfTextPages(dfa.buffer);
    const evidencePage = pageTexts.find((text) => text.includes('Banco de Cabo Verde'));

    expect(pageCount).toBeGreaterThan(1);
    expect(evidencePage).toContain(`Pag. ${pageCount}/${pageCount}`);
  });
});

function renderInput(overrides: Partial<DfaRenderInput> = {}): DfaRenderInput {
  return {
    iud: 'CV3260630100200300001230100000000107616263314',
    qrCodeUrl: 'https://pe.efatura.cv/dfe/view/CV3260630100200300001230100000000107616263314',
    total: 22_053,
    currency: 'CVE',
    conversion: conversion(),
    ...overrides,
  };
}

function conversion(): CurrencyConversionMetadata {
  return {
    sourceCurrency: 'EUR',
    targetCurrency: 'CVE',
    rate: 110.265,
    rateType: 'reference',
    effectiveAt: new Date('2026-07-21T00:00:00Z'),
    retrievedAt: new Date('2026-07-21T12:30:00Z'),
    provider: 'Banco de Cabo Verde',
    sourceUrl: 'https://www.bcv.cv/taxas/2026-07-21',
    originalPayableAmount: 200,
    convertedPayableAmount: 22_053,
  };
}

function pdfTextPages(buffer: Buffer): string[] {
  return pdfContentStreams(buffer)
    .filter((stream) => stream.includes(' TJ'))
    .map(textFromContentStream);
}

function pdfTextOperations(buffer: Buffer): string[] {
  return pdfContentStreams(buffer).flatMap((stream) => {
    return Array.from(stream.matchAll(/\[([^\]]*)\]\s*TJ/g), ([, contents]) =>
      textFromTextArray(contents ?? ''),
    );
  });
}

function pdfContentStreams(buffer: Buffer): string[] {
  const source = buffer.toString('latin1');

  return Array.from(source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g), ([, contents]) => {
    try {
      return inflateSync(Buffer.from(contents ?? '', 'latin1')).toString('latin1');
    } catch {
      return '';
    }
  });
}

function textFromContentStream(stream: string): string {
  return Array.from(stream.matchAll(/\[([^\]]*)\]\s*TJ/g), ([, contents]) =>
    textFromTextArray(contents ?? ''),
  )
    .join('\n')
    .replaceAll('\u00a0', ' ');
}

function textFromTextArray(contents: string): string {
  return Array.from(contents.matchAll(/<([0-9a-f]+)>/gi), ([, hex]) =>
    Buffer.from(hex ?? '', 'hex').toString('latin1'),
  ).join('');
}
