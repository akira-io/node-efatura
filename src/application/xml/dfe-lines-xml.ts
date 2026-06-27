import type { DiscountData } from '../../domain/value-objects/discount-data';
import type {
  ExtraPropertyData,
  ItemData,
  LineItemData,
} from '../../domain/value-objects/line-item-data';
import type { QuantityData } from '../../domain/value-objects/quantity-data';
import type { TaxData } from '../../domain/value-objects/tax-data';
import { element, escapeAttribute, escapeXml } from './xml-core';

export function linesXml(lines: LineItemData[]): string {
  return `<Lines>${lines.map(lineXml).join('')}</Lines>`;
}

export function taxXml(tax: TaxData): string {
  return `<Tax TaxTypeCode="${escapeAttribute(tax.taxTypeCode)}">${element(
    'StampTaxCode',
    tax.stampTaxCode,
  )}${element('TaxPercentage', tax.taxPercentage)}${element('TaxAmount', tax.taxAmount)}${element(
    'TaxExemptionReasonCode',
    tax.taxExemptionReasonCode,
  )}${element('TaxTotal', tax.taxTotal)}</Tax>`;
}

export function discountXml(discount: DiscountData | null): string {
  if (!discount) {
    return '';
  }

  const valueType = discount.valueType ? ` ValueType="${escapeAttribute(discount.valueType)}"` : '';

  return `<Discount${valueType}>${escapeXml(discount.value)}</Discount>`;
}

function lineXml(line: LineItemData): string {
  const attributes = line.lineTypeCode
    ? ` LineTypeCode="${escapeAttribute(line.lineTypeCode)}"`
    : '';

  return `<Line${attributes}>${element('Id', line.id)}${element(
    'LineReferenceId',
    line.lineReferenceId,
  )}${element('OrderLineReference', line.orderLineReference)}${quantityXml(
    'Quantity',
    line.quantity,
  )}${element('Price', line.price)}${element('PriceExtension', line.priceExtension)}${discountXml(
    line.discount,
  )}${element('NetTotal', line.netTotal)}${line.taxes.map(taxXml).join('')}${itemXml(
    line.item,
  )}</Line>`;
}

function itemXml(item: ItemData): string {
  return `<Item>${element('Description', item.description)}${
    item.packQuantity ? quantityXml('PackQuantity', item.packQuantity) : ''
  }${element('Name', item.name)}${element('BrandName', item.brandName)}${element(
    'ModelName',
    item.modelName,
  )}${element('EmitterIdentification', item.emitterIdentification)}${standardIdentificationXml(
    item,
  )}${element('HazardousRiskIndicator', item.hazardousRiskIndicator)}${extraPropertiesXml(
    item.extraProperties,
  )}</Item>`;
}

function quantityXml(name: string, quantity: QuantityData): string {
  const standard =
    quantity.isStandardUnitCode === null
      ? ''
      : ` IsStandardUnitCode="${quantity.isStandardUnitCode}"`;

  return `<${name} UnitCode="${escapeAttribute(quantity.unitCode)}"${standard}>${escapeXml(
    quantity.value,
  )}</${name}>`;
}

function standardIdentificationXml(item: ItemData): string {
  if (!item.standardIdentification) {
    return '';
  }

  return `<StandardIdentification>${element(
    item.standardIdentification.type,
    item.standardIdentification.value,
  )}</StandardIdentification>`;
}

function extraPropertiesXml(properties: ExtraPropertyData[]): string {
  return properties.length === 0
    ? ''
    : `<ExtraProperties>${properties
        .map(
          (property) =>
            `<Property Name="${escapeAttribute(property.name)}">${escapeXml(property.value)}</Property>`,
        )
        .join('')}</ExtraProperties>`;
}
