import Decimal from 'decimal.js';
import { TaxTypeCode } from '../enums/tax-type-code';
import type { LineItemData } from './line-item-data';
import type { TaxData } from './tax-data';

interface TaxAccumulator {
  lineTotal: Decimal;
  aggregateTotal: Decimal;
  roundedLineTotal: Decimal;
  hasTaxTotal: boolean;
  hasComputedTax: boolean;
  canUseComputedTax: boolean;
}

export function lineSign(line: LineItemData): number {
  return line.lineTypeCode === 'D' ? -1 : 1;
}

export function isIgnoredLine(line: LineItemData): boolean {
  return line.lineTypeCode === 'I';
}

export function roundMoney(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function sumSignedLineAmounts(
  lines: LineItemData[],
  selector: (line: LineItemData) => number | null,
): number | null {
  let total = new Decimal(0);

  for (const line of lines) {
    if (isIgnoredLine(line)) {
      continue;
    }

    const value = selector(line);

    if (value === null) {
      return null;
    }

    total = total.plus(new Decimal(value).mul(lineSign(line)));
  }

  return roundMoney(total);
}

export function taxTotalsFrom(lines: LineItemData[]): {
  taxTotal: readonly number[] | null;
  withholdingTotal: readonly number[];
  hasWithholdingTaxTotal: boolean;
} {
  let missingTaxTotal = false;
  const taxTotal = taxAccumulator();
  const withholdingTotal = taxAccumulator();

  for (const line of lines) {
    const sign = lineSign(line);

    for (const tax of line.taxes) {
      if (tax.taxTotal === null) {
        if (tax.taxTypeCode === TaxTypeCode.NotApplicable || isIgnoredLine(line)) {
          continue;
        }

        missingTaxTotal = true;
        continue;
      }

      if (tax.taxTypeCode === TaxTypeCode.IncomeTax) {
        addTaxTotal(withholdingTotal, sign, line, tax);
        continue;
      }

      addTaxTotal(taxTotal, sign, line, tax);
    }
  }

  return {
    taxTotal: missingTaxTotal ? null : moneyCandidates(taxTotal),
    withholdingTotal: moneyCandidates(withholdingTotal),
    hasWithholdingTaxTotal: withholdingTotal.hasTaxTotal,
  };
}

function taxAccumulator(): TaxAccumulator {
  return {
    lineTotal: new Decimal(0),
    aggregateTotal: new Decimal(0),
    roundedLineTotal: new Decimal(0),
    hasTaxTotal: false,
    hasComputedTax: false,
    canUseComputedTax: true,
  };
}

function addTaxTotal(
  accumulator: TaxAccumulator,
  sign: number,
  line: LineItemData,
  tax: TaxData,
): void {
  accumulator.hasTaxTotal = true;
  accumulator.lineTotal = accumulator.lineTotal.plus(new Decimal(tax.taxTotal ?? 0).mul(sign));

  const computedTax = computedTaxFrom(line, tax);

  if (computedTax === null) {
    accumulator.canUseComputedTax = false;
    return;
  }

  accumulator.hasComputedTax = true;
  accumulator.aggregateTotal = accumulator.aggregateTotal.plus(computedTax.mul(sign));
  accumulator.roundedLineTotal = accumulator.roundedLineTotal.plus(
    new Decimal(roundMoney(computedTax)).mul(sign),
  );
}

function computedTaxFrom(line: LineItemData, tax: TaxData): Decimal | null {
  if (line.netTotal === null || tax.taxPercentage === null) {
    return null;
  }

  return new Decimal(line.netTotal).mul(tax.taxPercentage).div(100);
}

function moneyCandidates(accumulator: TaxAccumulator): readonly number[] {
  const candidates = [roundMoney(accumulator.lineTotal)];

  if (accumulator.canUseComputedTax && accumulator.hasComputedTax) {
    candidates.push(roundMoney(accumulator.aggregateTotal));
    candidates.push(roundMoney(accumulator.roundedLineTotal));
  }

  return uniqueMoneyCandidates(candidates);
}

function uniqueMoneyCandidates(candidates: readonly number[]): readonly number[] {
  const uniqueCandidates: number[] = [];

  for (const candidate of candidates) {
    const roundedCandidate = roundMoney(candidate);

    if (!uniqueCandidates.includes(roundedCandidate)) {
      uniqueCandidates.push(roundedCandidate);
    }
  }

  return uniqueCandidates;
}
