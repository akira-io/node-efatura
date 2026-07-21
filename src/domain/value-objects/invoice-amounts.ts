import { TaxTypeCode } from '../enums/tax-type-code';
import type { LineItemData } from './line-item-data';
import type { TaxData } from './tax-data';

interface TaxAccumulator {
  lineTotal: number;
  aggregateTotal: number;
  roundedLineTotal: number;
  hasComputedTax: boolean;
  canUseComputedTax: boolean;
}

export function lineSign(line: LineItemData): number {
  return line.lineTypeCode === 'D' ? -1 : 1;
}

export function isIgnoredLine(line: LineItemData): boolean {
  return line.lineTypeCode === 'I';
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumSignedLineAmounts(
  lines: LineItemData[],
  selector: (line: LineItemData) => number | null,
): number | null {
  let total = 0;

  for (const line of lines) {
    if (isIgnoredLine(line)) {
      continue;
    }

    const value = selector(line);

    if (value === null) {
      return null;
    }

    total += lineSign(line) * value;
  }

  return roundMoney(total);
}

export function taxTotalsFrom(lines: LineItemData[]): {
  taxTotal: readonly number[] | null;
  withholdingTotal: readonly number[];
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
  };
}

function taxAccumulator(): TaxAccumulator {
  return {
    lineTotal: 0,
    aggregateTotal: 0,
    roundedLineTotal: 0,
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
  accumulator.lineTotal += sign * (tax.taxTotal ?? 0);

  const computedTax = computedTaxFrom(line, tax);

  if (computedTax === null) {
    accumulator.canUseComputedTax = false;
    return;
  }

  accumulator.hasComputedTax = true;
  accumulator.aggregateTotal += sign * computedTax;
  accumulator.roundedLineTotal += sign * roundMoney(computedTax);
}

function computedTaxFrom(line: LineItemData, tax: TaxData): number | null {
  if (line.netTotal === null || tax.taxPercentage === null) {
    return null;
  }

  return line.netTotal * (tax.taxPercentage / 100);
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
