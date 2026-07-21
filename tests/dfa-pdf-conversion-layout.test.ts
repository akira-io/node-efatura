import { describe, expect, it } from 'vitest';
import type { CurrencyConversionMetadata } from '../src/core/contracts';
import { renderDfaConversionEvidence } from '../src/infrastructure/dfa/pdf-dfa-conversion';

const evidenceBottomY = 676;
const valueWidth = 387;

describe('DFA PDF conversion evidence layout', () => {
  it('measures wrapped provider and URL rows and continues them across bounded pages', () => {
    const document = new GeometryDocument();
    const provider = `Provider evidence ${'P'.repeat(9_000)}`;
    const sourceUrl = `https://rates.example/${'source-segment/'.repeat(1_000)}`;
    const conversion = conversionWith(provider, sourceUrl);
    let pageTransitions = 0;

    const endY = renderDfaConversionEvidence(
      document as unknown as PDFKit.PDFDocument,
      conversion,
      620,
      () => {
        pageTransitions += 1;
        document.addPage();

        return 245;
      },
    );
    const valuePlacements = document.placements.filter((placement) => placement.x === 154);
    const providerPlacements = valuePlacements.filter(
      (placement) => placement.text.length > 8 && provider.includes(placement.text),
    );
    const sourcePlacements = valuePlacements.filter(
      (placement) => placement.text.length > 8 && sourceUrl.includes(placement.text),
    );

    expect(providerPlacements.map((placement) => placement.text).join('')).toBe(provider);
    expect(sourcePlacements.map((placement) => placement.text).join('')).toBe(sourceUrl);
    expect(pageTransitions).toBeGreaterThan(2);
    expect(endY).toBeLessThanOrEqual(evidenceBottomY);
    expect(
      [...providerPlacements, ...sourcePlacements].every((placement) => {
        return (
          placement.y + document.heightOfString(placement.text, { width: valueWidth }) <=
          evidenceBottomY
        );
      }),
    ).toBe(true);

    const firstSourcePlacement = required(sourcePlacements[0]);
    const lastProviderPlacement = required(providerPlacements.at(-1));
    expect(firstSourcePlacement.page).toBe(lastProviderPlacement.page);
    const providerBottom =
      lastProviderPlacement.y +
      document.heightOfString(lastProviderPlacement.text, { width: valueWidth });
    expect(firstSourcePlacement.y).toBeGreaterThanOrEqual(providerBottom + 5);
  });
});

interface TextPlacement {
  page: number;
  text: string;
  x: number;
  y: number;
}

class GeometryDocument {
  readonly placements: TextPlacement[] = [];
  #page = 0;

  addPage(): this {
    this.#page += 1;

    return this;
  }

  fillColor(): this {
    return this;
  }

  font(): this {
    return this;
  }

  fontSize(): this {
    return this;
  }

  moveTo(): this {
    return this;
  }

  lineTo(): this {
    return this;
  }

  stroke(): this {
    return this;
  }

  text(text: string, x: number, y: number): this {
    this.placements.push({ page: this.#page, text, x, y });

    return this;
  }

  heightOfString(text: string, options: { width?: number }): number {
    const charactersPerLine = Math.max(1, Math.floor((options.width ?? valueWidth) / 4));

    return Math.max(10, Math.ceil(text.length / charactersPerLine) * 10);
  }
}

function conversionWith(provider: string, sourceUrl: string): CurrencyConversionMetadata {
  return {
    sourceCurrency: 'EUR',
    targetCurrency: 'CVE',
    rate: 110.265,
    rateType: 'reference',
    effectiveAt: new Date('2026-07-21T00:00:00Z'),
    retrievedAt: new Date('2026-07-21T12:30:00Z'),
    provider,
    sourceUrl,
    originalPayableAmount: 200,
    convertedPayableAmount: 22_053,
  };
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Expected layout placement was not recorded.');
  }

  return value;
}
