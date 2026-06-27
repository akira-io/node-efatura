import type { ResolvedEfaturaConfig } from '../../config';
import { documentTypeCode } from '../../domain/enums/document-type';
import { EfaturaValidationError } from '../../domain/errors';
import { validateEventId } from '../../domain/iud/event-id';
import type { EventData, EventDocumentRangeData } from '../../domain/value-objects/event-data';
import { transmissionXml } from './dfe-structures-xml';
import { DFE_NAMESPACE, DFE_XML_VERSION, type EmissionMode } from './dfe-xml';
import { element, escapeAttribute, escapeXml } from './xml-core';

export interface BuildEventXmlInput {
  eventId: string;
  event: EventData;
  config: ResolvedEfaturaConfig;
  emissionMode?: EmissionMode;
}

export function buildEventXml(input: BuildEventXmlInput): string {
  if (!validateEventId(input.eventId)) {
    throw new EfaturaValidationError('eventId', 'Event Id is invalid.', 'event.id_invalid');
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Event xmlns="${DFE_NAMESPACE}" Version="${DFE_XML_VERSION}" Id="${escapeAttribute(
      input.eventId,
    )}" EventTypeCode="${input.event.type}">`,
    `<EmitterTaxId CountryCode="CV">${escapeXml(input.config.transmitterNif)}</EmitterTaxId>`,
    element('IssueDateTime', input.event.issueDateTime),
    element('IssueReasonDescription', input.event.issueReasonDescription),
    eventTargetXml(input.event),
    transmissionXml({
      config: input.config,
      emissionMode: input.emissionMode,
      contingency: null,
    }),
    element('RepositoryCode', input.config.repositoryCode),
    '</Event>',
  ].join('');
}

function eventTargetXml(event: EventData): string {
  if (event.iuds.length > 0) {
    return event.iuds.map((iud) => element('IUD', iud)).join('');
  }

  return rangeXml(requiredRange(event.range));
}

function rangeXml(range: EventDocumentRangeData): string {
  return `${element('Year', range.year)}${element('LedCode', range.ledCode)}${element(
    'Serie',
    range.serie,
  )}${element('DocumentTypeCode', documentTypeCode(range.documentType))}${element(
    'DocumentNumberStart',
    range.documentNumberStart,
  )}${element('DocumentNumberEnd', range.documentNumberEnd)}`;
}

function requiredRange(range: EventDocumentRangeData | null): EventDocumentRangeData {
  if (!range) {
    throw new EfaturaValidationError(
      'event.range',
      'Event range is required.',
      'event.range_required',
    );
  }

  return range;
}
